import { describe, it, expect } from 'vitest';
import { latexToOmml } from '@/lib/export/latex-to-omml';

const supported: Record<string, string> = {
  frac: String.raw`\frac{a+b}{c^2}`,
  supsub: String.raw`x_i^2 + y_{ij}^{n+1}`,
  sum: String.raw`\sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}`,
  matrix: String.raw`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`,
};

describe('latexToOmml (plurimath)', () => {
  for (const [name, latex] of Object.entries(supported)) {
    it(
      `converts ${name} to an inner <m:oMath> with Cambria Math runs`,
      async () => {
        const omml = await latexToOmml(latex, 12);
        expect(omml).not.toBeNull();
        expect(omml!.startsWith('<m:oMath')).toBe(true);
        expect(omml).not.toContain('oMathPara');
        expect(omml).not.toContain('xmlns:w');
        expect(omml).toContain('Cambria Math');
        expect(omml).toContain('sz="1200"');
      },
      30_000,
    );
  }

  it(
    'returns null for an unsupported environment (cases) so the caller falls back to the SVG path',
    async () => {
      const omml = await latexToOmml(
        String.raw`f(x)=\begin{cases} x^2 & x\ge 0 \\ -x & x<0 \end{cases}`,
      );
      expect(omml).toBeNull();
    },
    30_000,
  );
});
