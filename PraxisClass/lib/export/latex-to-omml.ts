import { createLogger } from '@/lib/logger';

const log = createLogger('LatexToOmml');

/**
 * Build <a:rPr> for math runs. PowerPoint requires Cambria Math font.
 * @param szHundredths - font size in hundredths of a point (e.g. 1200 = 12pt). Omit for no sz.
 */
function buildMathRPr(szHundredths?: number): string {
  const szAttr = szHundredths ? ` sz="${szHundredths}"` : '';
  return (
    `<a:rPr lang="en-US" i="1"${szAttr}>` +
    '<a:latin typeface="Cambria Math" panose="02040503050406030204" charset="0"/>' +
    '<a:cs typeface="Cambria Math" panose="02040503050406030204" charset="0"/>' +
    '</a:rPr>'
  );
}

/**
 * Post-process OMML for PPTX compatibility:
 * 1. Strip xmlns:w (wordprocessingml is DOCX-only, not valid in PPTX)
 * 2. Strip redundant xmlns:m (already declared at <p:sld> level)
 * 3. Inject <a:rPr> with Cambria Math font (and optional sz) into <m:r> and <m:ctrlPr>
 */
function postProcessOmml(omml: string, szHundredths?: number): string {
  let result = omml;
  const rpr = buildMathRPr(szHundredths);

  // Strip DOCX-only xmlns:w and redundant xmlns:m from <m:oMath>
  result = result.replace(/ xmlns:w="[^"]*"/g, '');
  result = result.replace(/ xmlns:m="[^"]*"/g, '');

  // Insert <a:rPr> before <m:t> inside <m:r> (only if not already present)
  result = result.replace(/<m:r>(\s*)<m:t/g, `<m:r>$1${rpr}$1<m:t`);

  // Fill empty <m:ctrlPr/> with <a:rPr>
  result = result.replace(/<m:ctrlPr\/>/g, `<m:ctrlPr>${rpr}</m:ctrlPr>`);

  // Fill empty <m:ctrlPr></m:ctrlPr> with <a:rPr>
  result = result.replace(/<m:ctrlPr><\/m:ctrlPr>/g, `<m:ctrlPr>${rpr}</m:ctrlPr>`);

  return result;
}

/**
 * Convert a LaTeX string to OMML (Office Math Markup Language) XML.
 *
 * Pipeline: LaTeX → OMML (Plurimath) → unwrap oMathPara → inject font props
 *
 * @param latex - LaTeX math expression (without delimiters)
 * @param fontSize - Optional font size in points (e.g. 12). Applied as sz on every <a:rPr> in the OMML.
 * @returns OMML XML string (an `<m:oMath>` element), or `null` if conversion fails
 */
export async function latexToOmml(
  latex: string,
  fontSize?: number,
): Promise<string | null> {
  try {
    const mod = await import('@plurimath/plurimath');
    const Plurimath = mod.default;
    const converted = String(new Plurimath(latex, 'latex').toOmml());
    let omml = converted;

    const paraStart = converted.indexOf('<m:oMathPara');
    if (paraStart !== -1) {
      const paraOpenEnd = converted.indexOf('>', paraStart);
      const mathStart = converted.indexOf('<m:oMath', paraOpenEnd + 1);
      const mathClose = converted.indexOf('</m:oMath>', mathStart);
      if (mathStart !== -1 && mathClose !== -1) {
        omml = converted.slice(mathStart, mathClose + '</m:oMath>'.length);
      }
    }

    const szHundredths = fontSize ? Math.round(fontSize * 100) : undefined;
    return postProcessOmml(omml, szHundredths);
  } catch (error) {
    log.warn(
      `Failed to convert: "${latex}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
