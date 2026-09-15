import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { extractDocument } from '@/lib/document/extract';
import type { DocumentExtractorConfig } from '@/lib/document/types';
import { normalizeDocumentMimeType } from '@/lib/document/mime';
import {
  isServerConfiguredProvider,
  resolveManagedAliDocMindCredentials,
  resolvePDFApiKey,
  resolvePDFBaseUrl,
} from '@/lib/server/provider-config';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { knowledgeFilePath } from './store';
import { KNOWLEDGE_LIMITS, type KnowledgeDraft, type ManagedKnowledgeDocument } from './types';
interface SourceSection {
  text: string;
  location: string;
  title?: string;
}

export function sectionsToDrafts(sections: SourceSection[]): KnowledgeDraft[] {
  const drafts: KnowledgeDraft[] = [];
  let text = '';
  let first = '';
  let last = '';
  let title = '';
  const flush = () => {
    if (!text.trim()) return;
    drafts.push({
      id: `entry-${drafts.length + 1}`,
      title: (title || text.split('\n')[0]).slice(0, 120),
      content: text.trim(),
      location: first === last ? first : `${first} 至 ${last}`,
      enabled: true,
    });
    text = '';
    first = '';
    last = '';
    title = '';
  };
  let count = 0;
  for (const section of sections) {
    const value = section.text.trim();
    count += value.length;
    if (count > KNOWLEDGE_LIMITS.textChars)
      throw new Error('解析文字超过 24 万字，请拆分资料后上传');
    for (let offset = 0; offset < value.length; offset += 2200) {
      const piece = value.slice(offset, offset + 2200);
      if (text.length + piece.length > 2400) flush();
      if (!first) {
        first = section.location;
        title = section.title ?? '';
      }
      last = section.location;
      text += `${text ? '\n\n' : ''}${piece}`;
    }
  }
  flush();
  if (!drafts.length)
    throw new Error('未识别到可用文字。扫描件请选择远程 OCR，或检查原文件是否清晰、加密。');
  if (drafts.length > KNOWLEDGE_LIMITS.entries)
    throw new Error('知识片段超过 120 条，请按案例拆分资料');
  return drafts;
}

export async function parseKnowledgeDocument(
  doc: ManagedKnowledgeDocument,
  config: Partial<DocumentExtractorConfig> = {},
) {
  const buffer = await fs.readFile(knowledgeFilePath(doc.id));
  const extension = doc.fileName.split('.').at(-1)?.toLowerCase();
  if (extension === 'txt' || extension === 'md') {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new Error('请将文本文件保存为 UTF-8 编码后重新上传');
    }
    const entries = sectionsToDrafts(
      text.split(/\r?\n\s*\r?\n/).map((text, index) => ({
        text,
        location: `原文段落 ${index + 1}`,
      })),
    );
    return {
      entries,
      warnings: ['已直接读取文本，请核对知识名称和出处后发布。'],
      providerId: 'text',
    };
  }
  const providerId = config.providerId || doc.providerId;
  if (!['mineru-cloud', 'alidocmind', 'mineru'].includes(providerId))
    throw new Error('请选择已配置的在线解析服务');
  if (extension === 'pdf') {
    const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
    if (pdf.getPageCount() > KNOWLEDGE_LIMITS.pages)
      throw new Error('PDF 超过 150 页，请拆分后上传');
  }
  const mimeType = normalizeDocumentMimeType({ fileName: doc.fileName, mimeType: doc.mimeType });
  const managed = isServerConfiguredProvider('pdf', providerId);
  const managedCredentials =
    managed && providerId === 'alidocmind' ? resolveManagedAliDocMindCredentials() : undefined;
  const baseUrl = resolvePDFBaseUrl(providerId, managed ? undefined : config.baseUrl);
  if (baseUrl) {
    const error = await validateUrlForSSRF(baseUrl);
    if (error) throw new Error('解析服务地址不可用，请检查配置');
  }
  const artifact = await extractDocument({
    buffer,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType,
    config: {
      providerId,
      baseUrl,
      apiKey: resolvePDFApiKey(providerId, managed ? undefined : config.apiKey),
      accessKeyId: managed ? managedCredentials?.accessKeyId : config.accessKeyId,
      accessKeySecret: managed ? managedCredentials?.accessKeySecret : config.accessKeySecret,
      allowEnvFallback: managed,
      textOnly: true,
    },
  });
  if ((artifact.metadata.pageCount ?? 0) > KNOWLEDGE_LIMITS.pages)
    throw new Error('解析页数超过 150 页，请拆分资料');
  const layouts = artifact.blocks.filter((block) => block.type === 'layout' && block.text?.trim());
  const blocks = layouts.length
    ? layouts
    : artifact.blocks.filter(
        (block) =>
          ['text', 'markdown', 'table', 'formula'].includes(block.type) && block.text?.trim(),
      );
  const entries = sectionsToDrafts(
    blocks.map((block) => ({
      text: block.text ?? '',
      location:
        block.pageNumber && block.pageNumber > 0
          ? `文档页序 ${block.pageNumber}`
          : '原文位置待核对',
    })),
  );
  const warnings = artifact.diagnostics?.map((item) => item.message).slice(0, 10) ?? [];
  if (entries.some((entry) => entry.location.includes('待核对')))
    warnings.push('解析服务未返回逐段页码，请对照原文件补充出处。');
  warnings.push('自动切分结果为草稿，请核对知识名称、数值、步骤和出处后再发布。');
  return { entries, warnings, providerId };
}
