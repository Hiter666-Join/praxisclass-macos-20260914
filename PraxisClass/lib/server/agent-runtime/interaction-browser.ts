import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Frame, type Browser } from 'playwright-core';
import { Type, type Static } from 'typebox';
import { patchHtmlForIframe } from '@/lib/utils/iframe';

const selector = Type.String({ minLength: 1, maxLength: 300 });
const text = Type.String({ maxLength: 2000 });
const Step = Type.Union([
  Type.Object({ action: Type.Literal('click'), selector }),
  Type.Object({ action: Type.Literal('fill'), selector, value: text }),
  Type.Object({ action: Type.Literal('select'), selector, value: text }),
  Type.Object({ action: Type.Literal('check'), selector, value: Type.Boolean() }),
  Type.Object({ action: Type.Literal('press'), selector, key: Type.String({ maxLength: 40 }) }),
  Type.Object({
    action: Type.Literal('expect'),
    selector,
    property: Type.Union([Type.Literal('text'), Type.Literal('value')]),
    expected: text,
  }),
  Type.Object({
    action: Type.Literal('expect'),
    selector,
    property: Type.Union([
      Type.Literal('visible'),
      Type.Literal('enabled'),
      Type.Literal('checked'),
    ]),
    expected: Type.Boolean(),
  }),
  Type.Object({
    action: Type.Literal('expect'),
    selector,
    property: Type.Literal('count'),
    expected: Type.Integer({ minimum: 0, maximum: 500 }),
  }),
]);

export const InteractionCaseSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  requirementId: Type.Optional(Type.String({ minLength: 1, maxLength: 80, description: 'Active requirement ID from read_course_brief.' })),
  requirement: Type.String({
    minLength: 1,
    maxLength: 500,
    description:
      'The current user requirement this case verifies; do not weaken it to fit the page.',
  }),
  steps: Type.Array(Step, { minItems: 1, maxItems: 20 }),
});
export type InteractionCase = Static<typeof InteractionCaseSchema>;
type InteractionStep = Static<typeof Step>;

export interface InteractionResult {
  status: 'passed' | 'failed' | 'unavailable';
  cases: Array<{
    name: string;
    requirement: string;
    passed: boolean;
    checks: Array<{
      step: number;
      selector: string;
      property: string;
      expected: unknown;
      actual: unknown;
    }>;
    error?: string;
    snapshot?: string;
    runtimeErrors: string[];
  }>;
  blockedRequests: string[];
  message?: string;
}

/** Uses an installed browser, never a user's profile or a browser download. */
export function interactionBrowserExecutable(): string | undefined {
  const candidates = [
    process.env.PRAXIS_BROWSER_EXECUTABLE,
    process.env.PROGRAMFILES &&
      join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] &&
      join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    chromium.executablePath(),
  ];
  return candidates.find((path): path is string => !!path && existsSync(path));
}

const clip = (value: string, limit = 1000) => value.slice(0, limit);
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

async function actualValue(frame: Frame, step: Extract<InteractionStep, { action: 'expect' }>) {
  const target = frame.locator(step.selector);
  switch (step.property) {
    case 'text':
      return normalize(await target.innerText());
    case 'value':
      return target.inputValue();
    case 'visible':
      return target.isVisible();
    case 'enabled':
      return target.isEnabled();
    case 'checked':
      return target.isChecked();
    case 'count':
      return target.count();
  }
}

/** Execute saved HTML with the same iframe shims/sandbox as the classroom. */
export async function runInteractionBrowser(
  html: string,
  cases: InteractionCase[],
  signal?: AbortSignal,
): Promise<InteractionResult> {
  signal?.throwIfAborted();
  const executablePath = interactionBrowserExecutable();
  if (!executablePath)
    return {
      status: 'unavailable',
      cases: [],
      blockedRequests: [],
      message:
        '未找到 Chrome/Chromium，未执行互动检查。安装浏览器或设置 PRAXIS_BROWSER_EXECUTABLE；不要修改课程来掩盖执行条件缺失。',
    };
  let browser: Browser;
  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      chromiumSandbox: true,
      timeout: 10_000,
    });
  } catch {
    return {
      status: 'unavailable',
      cases: [],
      blockedRequests: [],
      message:
        'Chrome/Chromium 启动失败，互动行为尚未验证。请检查浏览器运行条件，不能据此声称课程出错或检查通过。',
    };
  }
  const result: InteractionResult = { status: 'passed', cases: [], blockedRequests: [] };
  const blocked = new Set<string>();
  // Common course libraries are static assets, not classroom/API services.
  // Reuse bytes across cases; routing otherwise disables Chromium's HTTP cache.
  const assets = new Map<string, { body: Buffer; contentType: string }>();
  const staticHosts = new Set([
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'cdn.tailwindcss.com',
    'unpkg.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ]);
  const executionSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(30_000),
  ]);
  const close = () => {
    void browser.close().catch(() => {});
  };
  executionSignal.addEventListener('abort', close, { once: true });
  try {
    executionSignal.throwIfAborted();
    for (const testCase of cases.length
      ? cases
      : [{ name: '页面载入观察', requirement: '观察控件与脚本错误；未验证目标行为', steps: [] }]) {
      executionSignal.throwIfAborted();
      // The opaque iframe already disallows service workers. Playwright's
      // serviceWorkers:'block' shim itself throws there and would create false failures.
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        acceptDownloads: false,
      });
      const entry: InteractionResult['cases'][number] = {
        name: testCase.name,
        requirement: testCase.requirement,
        passed: false,
        checks: [],
        runtimeErrors: [],
      };
      result.cases.push(entry);
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(2000);
        const root = 'https://praxis-interaction.invalid/';
        let served = false;
        await context.route('**/*', async (route) => {
          if (
            !served &&
            route.request().url() === root &&
            route.request().isNavigationRequest() &&
            !route.request().frame().parentFrame()
          ) {
            served = true;
            await route.fulfill({
              contentType: 'text/html',
              body: '<!doctype html><html><body style="margin:0"><iframe id="scene" sandbox="allow-scripts allow-forms allow-popups" style="width:100vw;height:100vh;border:0"></iframe></body></html>',
            });
          } else if (
            route.request().method() === 'GET' &&
            ['script', 'stylesheet', 'font', 'image'].includes(route.request().resourceType()) &&
            new URL(route.request().url()).protocol === 'https:' &&
            staticHosts.has(new URL(route.request().url()).hostname)
          ) {
            try {
              const url = route.request().url();
              let asset = assets.get(url);
              if (!asset) {
                const response = await route.fetch({ timeout: 5000, maxRedirects: 0 });
                if (!response.ok()) throw new Error('static asset unavailable');
                const body = await response.body();
                if (body.length > 5_000_000) throw new Error('static asset too large');
                asset = {
                  body,
                  contentType: response.headers()['content-type'] || 'application/octet-stream',
                };
                assets.set(url, asset);
              }
              await route.fulfill({ ...asset, headers: { 'access-control-allow-origin': '*' } });
            } catch {
              if (blocked.size < 10) blocked.add(clip(route.request().url().split(/[?#]/)[0], 200));
              await route.abort().catch(() => {});
            }
          } else {
            if (blocked.size < 10) blocked.add(clip(route.request().url().split(/[?#]/)[0], 200));
            await route.abort();
          }
        });
        await context.routeWebSocket('**/*', (socket) => {
          socket.close();
        });
        page.on('pageerror', (error) => {
          if (entry.runtimeErrors.length < 5) entry.runtimeErrors.push(clip(error.message));
        });
        page.on('console', (message) => {
          if (message.type() === 'error' && entry.runtimeErrors.length < 5)
            entry.runtimeErrors.push(clip(message.text()));
        });
        page.on('dialog', (dialog) => {
          void dialog.dismiss().catch(() => {});
        });
        context.on('page', (popup) => {
          if (popup !== page) void popup.close().catch(() => {});
        });
        await page.goto(root, { waitUntil: 'domcontentloaded' });
        await page.locator('#scene').evaluate((iframe, source) => {
          (iframe as HTMLIFrameElement).srcdoc = source;
        }, patchHtmlForIframe(html));
        const frame = await (await page.locator('#scene').elementHandle())!.contentFrame();
        if (!frame) throw new Error('课程 iframe 未载入');
        // The first load may still be the empty about:blank document.
        await frame.waitForFunction(() => !!document.querySelector('[data-iframe-storage-shim]'));
        await frame.waitForLoadState('load');
        for (const [index, step] of testCase.steps.entries()) {
          executionSignal.throwIfAborted();
          try {
            const target = frame.locator(step.selector);
            switch (step.action) {
              case 'click':
                await target.click();
                break;
              case 'fill':
                await target.fill(step.value);
                break;
              case 'select':
                await target.selectOption(step.value);
                break;
              case 'check':
                await target.setChecked(step.value);
                break;
              case 'press':
                await target.press(step.key);
                break;
              case 'expect': {
                const expected =
                  step.property === 'text' ? normalize(String(step.expected)) : step.expected;
                const until = Date.now() + 2000;
                let actual = await actualValue(frame, step);
                while (actual !== expected && Date.now() < until && !executionSignal.aborted) {
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  actual = await actualValue(frame, step);
                }
                entry.checks.push({
                  step: index + 1,
                  selector: step.selector,
                  property: step.property,
                  expected: step.expected,
                  actual: typeof actual === 'string' ? clip(actual) : actual,
                });
                if (actual !== expected)
                  throw new Error(
                    `断言失败：${step.selector} ${step.property} 预期 ${JSON.stringify(step.expected)}，实际 ${JSON.stringify(actual).slice(0, 1000)}`,
                  );
                break;
              }
            }
          } catch (error) {
            throw new Error(
              `步骤 ${index + 1} (${step.action} ${step.selector}): ${clip(error instanceof Error ? error.message : String(error))}`,
            );
          }
        }
        entry.snapshot = clip(await frame.locator('body').ariaSnapshot(), 2500);
        entry.passed = !entry.runtimeErrors.length;
      } catch (error) {
        entry.error = clip(error instanceof Error ? error.message : String(error));
        const frame = context.pages()[0]?.frames()[1];
        if (frame && !executionSignal.aborted)
          entry.snapshot = await frame
            .locator('body')
            .ariaSnapshot({ timeout: 500 })
            .then((value) => clip(value, 2500))
            .catch(() => undefined);
      } finally {
        await context.close().catch(() => {});
      }
    }
  } catch (error) {
    result.message = executionSignal.aborted
      ? '互动检查已取消或超过 30 秒执行限时，未完成的用例不能视为通过。'
      : clip(String(error));
  } finally {
    executionSignal.removeEventListener('abort', close);
    await browser.close().catch(() => {});
  }
  result.blockedRequests = [...blocked];
  result.status = result.message || result.cases.some((item) => !item.passed) ? 'failed' : 'passed';
  if (blocked.size) {
    result.status = 'unavailable';
    result.message =
      '页面请求了未接入的外部资源/服务，相关行为未完整验证。此工具仅执行自包含互动 HTML，不会调用真实服务或提交学习记录；不要移除原要求来迎合测试环境。';
  }
  return result;
}
