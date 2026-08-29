function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value: string) {
  return ascii(value).replace(/([\\()])/g, "\\$1");
}

export function createTextPdf(title: string, lines: string[]) {
  const wrapped = lines.flatMap((line) => {
    const words = ascii(line).split(/\s+/u);
    const result: string[] = [];
    let current = "";
    for (const word of words) {
      if (`${current} ${word}`.trim().length > 88) { if (current) result.push(current); current = word; }
      else current = `${current} ${word}`.trim();
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  });
  const linesPerPage = 46;
  const chunks = Array.from({ length: Math.max(1, Math.ceil(wrapped.length / linesPerPage)) }, (_, index) => wrapped.slice(index * linesPerPage, (index + 1) * linesPerPage));
  const fontId = 3 + chunks.length * 2;
  const pageIds = chunks.map((_, index) => 3 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`,
  ];
  chunks.forEach((chunk, pageIndex) => {
    const pageId = pageIds[pageIndex], contentId = pageId + 1;
    const commands = ["BT", "/F1 15 Tf", "44 800 Td", `(${pdfText(title).slice(0, 88)}) Tj`, "/F1 10 Tf", "0 -24 Td"];
    chunk.forEach((line, index) => { if (index > 0) commands.push("0 -15 Td"); commands.push(`(${pdfText(line)}) Tj`); });
    commands.push("ET", "BT", "/F1 9 Tf", "500 24 Td", `(Page ${pageIndex + 1}/${chunks.length}) Tj`, "ET");
    const stream = commands.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "ascii");
}
