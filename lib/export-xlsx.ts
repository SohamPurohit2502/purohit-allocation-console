import { strToU8, zipSync } from 'fflate';
import type { Allocation } from './domain';

const escapeXml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );

function columnName(column: number) {
  let name = '';
  for (; column; column = Math.floor((column - 1) / 26))
    name = String.fromCharCode(65 + ((column - 1) % 26)) + name;
  return name;
}

const textCell = (row: number, column: number, value: unknown, style = 0) =>
  `<c r="${columnName(column)}${row}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
const numberCell = (row: number, column: number, value: number, style = 0) =>
  `<c r="${columnName(column)}${row}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
const worksheetRow = (row: number, cells: string[], height?: number) =>
  `<row r="${row}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells.join('')}</row>`;

function safeSheetName(name: string, used: Set<string>) {
  const base =
    name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) ||
    'Investor';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase()))
    candidate = `${base.slice(0, 27)} ${suffix++}`.slice(0, 31);
  used.add(candidate.toLowerCase());
  return candidate;
}

function createWorksheet(records: Allocation[]) {
  let rowNumber = 1;
  const rows: string[] = [];
  const merges: string[] = [];
  rows.push(worksheetRow(rowNumber, [textCell(rowNumber, 1, 'Purohit Associates LLP', 1)], 24));
  merges.push(`A${rowNumber}:F${rowNumber++}`);
  rows.push(worksheetRow(rowNumber, [textCell(rowNumber, 1, 'Investment allocation drafts', 2)], 20));
  merges.push(`A${rowNumber}:F${rowNumber++}`);
  rows.push(
    worksheetRow(rowNumber, [
      textCell(rowNumber, 1, 'Client', 3),
      textCell(rowNumber, 2, records[0].client.name, 4),
      textCell(rowNumber, 4, 'Client ID', 3),
      textCell(rowNumber, 5, records[0].client.id, 4),
    ]),
  );
  rowNumber += 2;

  records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((allocation, index) => {
      rows.push(
        worksheetRow(
          rowNumber,
          [
            textCell(rowNumber, 1, `Draft ${index + 1}`, 5),
            textCell(
              rowNumber,
              2,
              new Date(allocation.date).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              }),
              5,
            ),
            textCell(rowNumber, 5, 'Total investment', 5),
            numberCell(rowNumber, 6, allocation.total / 100, 8),
          ],
          21,
        ),
      );
      merges.push(`B${rowNumber}:D${rowNumber}`);
      rowNumber++;
      rows.push(
        worksheetRow(
          rowNumber,
          ['Scheme', 'AMC', 'Category', 'Folio number', 'Allocation %', 'Amount (INR)'].map(
            (heading, index) => textCell(rowNumber, index + 1, heading, 6),
          ),
          24,
        ),
      );
      rowNumber++;
      allocation.lines.forEach((line) => {
        rows.push(
          worksheetRow(
            rowNumber,
            [
              textCell(rowNumber, 1, line.scheme.official),
              textCell(rowNumber, 2, line.scheme.amc),
              textCell(rowNumber, 3, line.scheme.category),
              textCell(rowNumber, 4, line.folio || '', 7),
              numberCell(rowNumber, 5, allocation.total ? line.amount / allocation.total : 0, 9),
              numberCell(rowNumber, 6, line.amount / 100, 8),
            ],
            32,
          ),
        );
        rowNumber++;
      });
      const allocated = allocation.lines.reduce((sum, line) => sum + line.amount, 0);
      rows.push(
        worksheetRow(
          rowNumber,
          [
            textCell(rowNumber, 1, 'Total allocated', 10),
            textCell(rowNumber, 2, '', 10),
            textCell(rowNumber, 3, '', 10),
            textCell(rowNumber, 4, '', 10),
            numberCell(rowNumber, 5, allocation.total ? allocated / allocation.total : 0, 11),
            numberCell(rowNumber, 6, allocated / 100, 12),
          ],
          22,
        ),
      );
      merges.push(`A${rowNumber}:D${rowNumber}`);
      rowNumber += 2;
    });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="47" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/><col min="4" max="4" width="20" customWidth="1"/><col min="5" max="5" width="14" customWidth="1"/><col min="6" max="6" width="18" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map((merge) => `<mergeCell ref="${merge}"/>`).join('')}</mergeCells><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

export function allocationWorkbook(records: Allocation[]) {
  if (!records.length) throw Error('Select at least one draft.');
  const groups = new Map<string, Allocation[]>();
  records.forEach((allocation) =>
    groups.set(allocation.client.id, [...(groups.get(allocation.client.id) || []), allocation]),
  );
  const usedNames = new Set<string>();
  const sheets = [...groups.values()].map((allocations, index) => ({
    id: index + 1,
    name: safeSheetName(allocations[0].client.name, usedNames),
    xml: createWorksheet(allocations),
  }));
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((sheet) => `<Override PartName="/xl/worksheets/sheet${sheet.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const rootRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${sheet.id}" r:id="rId${sheet.id}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const workbookRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((sheet) => `<Relationship Id="rId${sheet.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheet.id}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="₹#,##0.00;[Red](₹#,##0.00);-"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Aptos"/><color rgb="FF203349"/></font><font><b/><sz val="16"/><name val="Aptos Display"/><color rgb="FF203349"/></font><font><b/><sz val="12"/><name val="Aptos"/><color rgb="FF203349"/></font><font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F3F2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF087C80"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F6F7"/></patternFill></fill></fills><borders count="3"><border/><border><bottom style="thin"><color rgb="FFD7E0E5"/></bottom></border><border><top style="thin"><color rgb="FF9DBDC0"/></top><bottom style="double"><color rgb="FF9DBDC0"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="2" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="2" fillId="2" borderId="2" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"/><xf numFmtId="164" fontId="2" fillId="2" borderId="2" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRelationships),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRelationships),
    'xl/styles.xml': strToU8(styles),
  };
  sheets.forEach((sheet) => {
    files[`xl/worksheets/sheet${sheet.id}.xml`] = strToU8(sheet.xml);
  });
  return zipSync(files, { level: 6 });
}

export function downloadAllocationsXlsx(
  records: Allocation[],
  name = 'allocation-drafts.xlsx',
) {
  const bytes = allocationWorkbook(records);
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
