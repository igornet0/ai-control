import { describe, expect, it } from 'vitest';
import {
  SPREADSHEET_FIELD_FORMAT,
  buildSpreadsheetBlock,
  createEmptySpreadsheetWorkbook,
  gridModelToTableColumns,
} from './spreadsheetGridUtils';
import { applyTemplateImport, isSpreadsheetFieldValue } from './templateImportUtils';

describe('templateImportUtils', () => {
  it('detects spreadsheet field values', () => {
    expect(isSpreadsheetFieldValue([{ a: 1 }])).toBe(true);
    expect(isSpreadsheetFieldValue({ __format: SPREADSHEET_FIELD_FORMAT, sh1: [] })).toBe(true);
    expect(isSpreadsheetFieldValue({ Название: 'Тест' })).toBe(false);
  });

  it('imports spreadsheet default_values into table template grid', () => {
    const wb = createEmptySpreadsheetWorkbook(1);
    const sheetId = wb.sheets[0].id;
    const colKey = gridModelToTableColumns(wb.sheets[0])[0].key;
    const block = buildSpreadsheetBlock('Данные', wb);
    const importedValue = {
      __format: SPREADSHEET_FIELD_FORMAT,
      [sheetId]: [{ [colKey]: 'A1' }],
    };
    const json = JSON.stringify({
      export_format: 'aicontrol.template',
      default_values: { Данные: importedValue },
    });

    const result = applyTemplateImport({
      text: json,
      format: 'json',
      mode: 'replace',
      targetFieldName: 'Данные',
      importSheetContent: false,
      isTableTemplate: true,
      fieldsList: [{ name: 'Данные', type: 'table' }],
      sheetBlocks: [block],
      defaultValues: {},
      tableGridModel: wb,
    });

    expect(result.ok).toBe(true);
    expect(result.patch.tableGridModel).toBeTruthy();
    expect(result.patch.defaultValues?.Данные).toBeTruthy();
    const mergedRows = result.patch.tableGridModel.sheets[0].cells;
    const dataCell = Object.values(mergedRows).find((c) => c?.value === 'A1');
    expect(dataCell).toBeTruthy();
  });

  it('imports full document template export with legacy table field', () => {
    const json = {
      export_format: 'aicontrol.template',
      title_template: 'Заказ клиента — № {номер}',
      sheet_content: [
        { type: 'field', field_name: 'Контрагент', displayType: 'form' },
        { type: 'field', field_name: 'Товары', displayType: 'table', tableColumns: [{ key: 'name', label: 'Наименование' }] },
      ],
      default_values: {
        Контрагент: 'ООО «Ромашка»',
        Товары: [{ name: 'Товар A', qty: 10, unit: 'шт' }],
        Склад: 'Основной склад',
      },
    };
    const sheetBlocks = [
      { type: 'field', field_name: 'Контрагент', displayType: 'form' },
      { type: 'field', field_name: 'Товары', displayType: 'table', tableColumns: [{ key: 'name', label: 'Наименование' }] },
    ];
    const result = applyTemplateImport({
      text: JSON.stringify(json),
      format: 'json',
      mode: 'replace',
      targetFieldName: 'Товары',
      importSheetContent: false,
      isTableTemplate: false,
      fieldsList: [{ name: 'Товары', type: 'table' }],
      sheetBlocks,
      defaultValues: { Контрагент: 'OLD' },
      tableGridModel: null,
    });

    expect(result.ok).toBe(true);
    expect(result.patch.defaultValues.Контрагент).toBe('ООО «Ромашка»');
    expect(result.patch.defaultValues.Склад).toBe('Основной склад');
    expect(result.patch.defaultValues.Товары).toEqual([{ name: 'Товар A', qty: 10, unit: 'шт' }]);
    expect(result.patch.titleTemplate).toContain('Заказ клиента');
  });

  it('auto-imports sheet_content for full template export', () => {
    const json = {
      export_format: 'aicontrol.template',
      default_values: { Контрагент: 'X' },
      sheet_content: [{ type: 'field', field_name: 'Контрагент', displayType: 'form' }],
    };
    const result = applyTemplateImport({
      text: JSON.stringify(json),
      format: 'json',
      mode: 'replace',
      targetFieldName: '',
      importSheetContent: false,
      isTableTemplate: false,
      fieldsList: [],
      sheetBlocks: [],
      defaultValues: {},
      tableGridModel: null,
    });

    expect(result.ok).toBe(true);
    expect(result.patch.sheetBlocks).toEqual(json.sheet_content);
    expect(result.message).toContain('Разметка листа');
  });

  it('updates table column labels from sheet_content and structure_fields on import', () => {
    const json = {
      export_format: 'aicontrol.template',
      sheet_content: [
        {
          type: 'field',
          field_name: 'Товары',
          displayType: 'table',
          tableColumns: [
            { key: 'name', label: 'Наименование (импорт)' },
            { key: 'qty', label: 'Кол-во (импорт)' },
            { key: 'unit', label: 'Ед. (импорт)' },
          ],
        },
      ],
      structure_fields: [
        {
          name: 'Товары',
          type: 'table',
          columns: [
            { key: 'name', label: 'Из структуры' },
            { key: 'qty', label: 'Кол-во' },
            { key: 'unit', label: 'Ед.' },
          ],
        },
      ],
      default_values: {
        Товары: [{ name: 'Товар A', qty: 1, unit: 'шт' }],
      },
    };
    const sheetBlocks = [
      {
        type: 'field',
        field_name: 'Товары',
        displayType: 'table',
        tableColumns: [
          { key: '№', label: '№' },
          { key: 'Наименование', label: 'Наименование' },
          { key: 'Кол-во', label: 'Кол-во' },
        ],
      },
    ];
    const result = applyTemplateImport({
      text: JSON.stringify(json),
      format: 'json',
      mode: 'replace',
      targetFieldName: 'Товары',
      importSheetContent: false,
      isTableTemplate: false,
      fieldsList: [{ name: 'Товары', type: 'table', columns: [{ key: 'name', label: 'Сервер' }] }],
      sheetBlocks,
      defaultValues: {},
      tableGridModel: null,
    });

    expect(result.ok).toBe(true);
    const goodsBlock = result.patch.sheetBlocks.find((b) => b.field_name === 'Товары');
    expect(goodsBlock.tableColumns).toEqual([
      { key: 'name', label: 'Наименование (импорт)' },
      { key: 'qty', label: 'Кол-во (импорт)' },
      { key: 'unit', label: 'Ед. (импорт)' },
    ]);
  });
});
