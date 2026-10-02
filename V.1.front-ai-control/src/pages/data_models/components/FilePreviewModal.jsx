import React, { useState, useEffect, useRef } from 'react';
import { 
  XMarkIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import mammoth from 'mammoth';
import { dataModelService } from '../../../services/dataModelService';
import FileTypeIcon from './FileTypeIcon';

const findMatchingSheetName = (desiredName, sheetNames) => {
  if (!Array.isArray(sheetNames) || sheetNames.length === 0) {
    return null;
  }

  if (!desiredName) {
    return sheetNames[0];
  }

  const candidates = [];
  const trimmed = desiredName.trim();

  candidates.push(trimmed);

  // Also add lowercase versions for case-insensitive comparison
  candidates.push(...candidates.map(name => name.toLowerCase()));

  // Try exact match first
  for (const candidate of candidates) {
    const match = sheetNames.find(name => name === candidate);
    if (match) {
      return match;
    }
  }

  // Try trimmed exact match
  for (const candidate of candidates) {
    const match = sheetNames.find(name => name.trim() === candidate);
    if (match) {
      return match;
    }
  }

  // Try case-insensitive match
  for (const candidate of candidates) {
    const match = sheetNames.find(name => name.trim().toLowerCase() === candidate);
    if (match) {
      return match;
    }
  }

  return null;
};

const FilePreviewModal = ({ isOpen, onClose, file, modelId, onUpload, isUploadMode = false }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contentType, setContentType] = useState('text');
  
  // Excel upload settings state
  const [workbook, setWorkbook] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [rawData, setRawData] = useState([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [startRow, setStartRow] = useState(1);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [columnNames, setColumnNames] = useState({});
  const [previewRows, setPreviewRows] = useState(10);
  const [isCSV, setIsCSV] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const viewWorkbookRef = useRef(null);

  useEffect(() => {
        if (isOpen && file) {
      if (isUploadMode) {
        const filename = file.name || file.original_filename || file.filename || '';
        const extension = filename.split('.').pop().toLowerCase();
        if (isExcelFile(file)) {
          loadExcelFileForUpload();
        } else if (extension === 'csv') {
          loadCSVFileForUpload();
        } else {
          // Для других файлов просто загружаем без настроек
          setError('Для этого типа файла настройки не требуются');
        }
      } else {
                loadFileContent();
      }
    } else {
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, file, isUploadMode]);

  const isExcelFile = (file) => {
    const filename = file.name || file.original_filename || file.filename || '';
    const extension = filename.split('.').pop().toLowerCase();
    return ['xlsx', 'xls'].includes(extension);
  };

  const resetState = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    viewWorkbookRef.current = null;
    setPdfUrl(null);
    setContent('');
    setError(null);
    setContentType('text');
    setWorkbook(null);
    setExcelSheets([]);
    setSelectedSheet('');
    setRawData([]);
    setHeaderRow(1);
    setStartRow(1);
    setPreviewData([]);
    setHeaders([]);
    setSelectedFields([]);
    setColumnNames({});
    setPreviewRows(10);
    setIsCSV(false);
    setCsvData([]);
  };

  const loadFileContent = async () => {
    if (!file || !modelId) {
            return;
    }

    const filename = file.original_filename || file.filename || file.name || 'неизвестный файл';
        setLoading(true);
    setError(null);
    setContent('');

    try {
      const filename = file.original_filename || file.filename || file.name || '';
      if (!filename) {
        throw new Error('Имя файла не указано');
      }
      const fileExtension = filename.split('.').pop().toLowerCase();
            
      // Добавляем таймаут для предотвращения бесконечной загрузки
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
                    reject(new Error('Таймаут загрузки файла (30 секунд)'));
        }, 30000);
      });
      
      const loadPromise = (async () => {
                
        // Если у файла есть data_schema, загружаем данные в виде таблицы
        if (file.data_schema && file.data_schema.headers && (fileExtension === 'csv' || ['xlsx', 'xls'].includes(fileExtension))) {
                    setContentType('table');
          await loadFileDataAsTable();
        } else if (fileExtension === 'csv') {
          // Для CSV файлов без data_schema пытаемся автоматически распарсить и отобразить как таблицу
                    setContentType('table');
          await loadCSVAsTable();
        } else if (['txt', 'json', 'xml', 'html', 'css', 'js', 'py', 'sql'].includes(fileExtension)) {
                    setContentType('text');
          await loadTextContent(fileExtension);
        } else if (['xlsx', 'xls'].includes(fileExtension)) {
                    setContentType('excel-view');
          await loadExcelForView();
        } else if (['pdf'].includes(fileExtension)) {
                    setContentType('pdf');
          await loadPdfContent();
        } else if (fileExtension === 'docx') {
                    setContentType('docx');
          await loadDocxContent();
        } else if (fileExtension === 'doc') {
          setContentType('binary');
          setContent('Формат .doc не поддерживает предпросмотр в браузере. Скачайте файл для просмотра.');
        } else {
                    setContentType('binary');
          setContent('Этот тип файла не может быть предварительно просмотрен.');
        }
              })();
      
            await Promise.race([loadPromise, timeoutPromise]);
            
    } catch (err) {
      console.error('Error loading file content:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError(`Ошибка загрузки содержимого файла: ${err.message}`);
    } finally {
            setLoading(false);
    }
  };

  const loadFileDataAsTable = async () => {
    try {
            
      if (!file.data_schema || !file.data_schema.headers || file.data_schema.headers.length === 0) {
        console.warn('File does not have data_schema with headers, falling back to Excel preview');
        setContentType('excel-view');
        await loadExcelForView();
        return;
      }
      
      const blob = await dataModelService.downloadModelFile(modelId, file);
      
      // data_schema уже нормализована на бэкенде
      const schema = file.data_schema;
      const headers = schema.headers || [];
      const selectedFields = schema.selectedFields || headers;
      const columnNames = schema.columnNames || {};
      const fileExtension = (file.original_filename || file.filename || file.name || '').split('.').pop().toLowerCase();

            
      let data = [];

      if (fileExtension === 'csv') {
        const text = await blob.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
                        if (results.errors.length === 0 && results.data.length > 0) {
              data = results.data
                .filter(row => Object.values(row).some(v => v && v.toString().trim() !== ''))
                .map(row => {
                  const filteredRow = {};
                  selectedFields.forEach(field => {
                    const displayName = columnNames[field] || field;
                    filteredRow[displayName] = row[field] || '';
                  });
                  return filteredRow;
                });
              
                            
              setHeaders(selectedFields.map(f => columnNames[f] || f));
              setSelectedFields(selectedFields);
              setColumnNames(columnNames);
              setPreviewData(data);
              setPreviewRows(Math.min(data.length, 100));
            } else {
              console.warn('No CSV data parsed, falling back to regular preview');
              setContentType('text');
              setContent(text);
            }
            setLoading(false);
          },
          error: (error) => {
            console.error('CSV parse error:', error);
            setError('Ошибка при парсинге CSV файла: ' + error.message);
            setLoading(false);
          }
        });
      } else if (['xlsx', 'xls'].includes(fileExtension)) {
        const arrayBuffer = await blob.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        viewWorkbookRef.current = wb;
        const normalizedSheetName = findMatchingSheetName(schema.excelSheet, wb.SheetNames);
        
                
        if (normalizedSheetName && wb.Sheets[normalizedSheetName]) {
          const sheetName = normalizedSheetName;
          const worksheet = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
                    
          const headerRowIndex = (schema.headerRow || 1) - 1;
          const dataStartIndex = headerRowIndex + (schema.startRow || 1);
          
                    
          data = jsonData.slice(dataStartIndex)
            .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
            .map(row => {
              const obj = {};
              selectedFields.forEach((field) => {
                const headerIndex = headers.indexOf(field);
                const displayName = columnNames[field] || field;
                obj[displayName] = headerIndex >= 0 ? (row[headerIndex] || '') : '';
              });
              return obj;
            });
          
                    
          if (data.length === 0) {
            console.warn('No data after processing, trying without startRow');
            // Попробуем без startRow
            data = jsonData.slice(headerRowIndex + 1)
              .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
              .map(row => {
                const obj = {};
                selectedFields.forEach((field) => {
                  const headerIndex = headers.indexOf(field);
                  const displayName = columnNames[field] || field;
                  obj[displayName] = headerIndex >= 0 ? (row[headerIndex] || '') : '';
                });
                return obj;
              });
                      }
          
          if (data.length === 0) {
            console.warn('Still no data, trying with all rows from headerRow');
            // Попробуем взять все строки начиная с headerRow
            data = jsonData.slice(headerRowIndex)
              .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
              .map(row => {
                const obj = {};
                selectedFields.forEach((field) => {
                  const headerIndex = headers.indexOf(field);
                  const displayName = columnNames[field] || field;
                  obj[displayName] = headerIndex >= 0 ? (row[headerIndex] || '') : '';
                });
                return obj;
              });
                      }
          
          if (data.length === 0) {
            console.error('No data could be extracted, falling back to Excel preview');
            setContentType('excel-view');
            await loadExcelForView();
            return;
          }
          
          setHeaders(selectedFields.map(f => columnNames[f] || f));
          setSelectedFields(selectedFields);
          setColumnNames(columnNames);
          setPreviewData(data);
          setPreviewRows(Math.min(data.length, 100));
          setSelectedSheet(sheetName);
          setExcelSheets(wb.SheetNames);
        } else {
          console.error('Sheet not found after normalization', { requested: schema.excelSheet, available: wb.SheetNames });
          setError(`Лист "${schema.excelSheet}" не найден. Доступные листы: ${wb.SheetNames.join(', ')}`);
        }
        setLoading(false);
      } else {
        setError('Неподдерживаемый тип файла для табличного отображения');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading file data as table:', error);
      setError(`Ошибка загрузки данных файла: ${error.message}`);
      setLoading(false);
    }
  };

  const loadCSVAsTable = async () => {
    try {
            const blob = await dataModelService.downloadModelFile(modelId, file);
      const text = await blob.text();
      
            
      // Парсим CSV с помощью Papa.parse
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
                    
          if (results.errors.length > 0) {
            console.warn('CSV parse errors:', results.errors);
          }
          
          if (results.data.length > 0) {
            // Фильтруем пустые строки
            const data = results.data.filter(row => 
              Object.values(row).some(v => v && v.toString().trim() !== '')
            );
            
            if (data.length > 0) {
              // Извлекаем заголовки из первой строки данных
              const headers = Object.keys(data[0]);
              
                            
              setHeaders(headers);
              setSelectedFields(headers);
              setPreviewData(data.slice(0, Math.min(data.length, 100)));
              setPreviewRows(Math.min(data.length, 100));
            } else {
              console.warn('No data after filtering, falling back to text');
              setContentType('text');
              setContent(text);
            }
          } else {
            console.warn('No CSV data parsed, falling back to text');
            setContentType('text');
            setContent(text);
          }
          setLoading(false);
        },
        error: (error) => {
          console.error('CSV auto-parse error:', error);
          console.warn('Falling back to text preview');
          setContentType('text');
          setContent(text);
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('Error loading CSV as table:', error);
      setError(`Ошибка загрузки CSV файла: ${error.message}`);
      setLoading(false);
    }
  };

  const loadTextContent = async (fileExtension) => {
    try {
      const filename = file.original_filename || file.filename || file.name || 'неизвестный файл';
                  
      const blob = await dataModelService.downloadModelFile(modelId, file);
                        
      if (!blob) {
        throw new Error('Blob не получен от сервера');
      }
      
      if (blob.size === 0) {
        throw new Error('Файл пуст');
      }
      
            const text = await blob.text();
                  
      setContent(text);
          } catch (err) {
      console.error('Text loading error:', err);
      console.error('Error stack:', err.stack);
      throw new Error(`Не удалось загрузить текстовый файл: ${err.message}`);
    }
  };

  const loadExcelFileForUpload = () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        
        setWorkbook(wb);
        const sheetNames = wb.SheetNames;
        setExcelSheets(sheetNames);
        
        if (sheetNames.length > 0) {
          setSelectedSheet(sheetNames[0]);
          loadSheetDataForUpload(wb, sheetNames[0]);
        } else {
          setError('Файл не содержит листов');
          setLoading(false);
        }
      } catch (err) {
        setError('Ошибка при чтении Excel файла: ' + err.message);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Ошибка при чтении файла');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const loadSheetDataForUpload = (wb, sheetName) => {
    try {
      const worksheet = wb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        setError(`Лист "${sheetName}" пуст`);
        setLoading(false);
        return;
      }

      setRawData(jsonData);
      processExcelDataForUpload(jsonData, headerRow);
      setLoading(false);
    } catch (err) {
      setError(`Ошибка при загрузке листа "${sheetName}": ` + err.message);
      setLoading(false);
    }
  };

  const processExcelDataForUpload = (jsonData, headerRowNum) => {
    const headerRowIndex = headerRowNum - 1;
    
    let fileHeaders = [];
    if (headerRowIndex >= 0 && headerRowIndex < jsonData.length) {
      const headerRowData = jsonData[headerRowIndex];
      fileHeaders = headerRowData.map((header, index) => 
        header ? header.toString().trim() : `Column_${index + 1}`
      );
    }
    
    if (fileHeaders.length === 0 || fileHeaders.every(h => !h)) {
      const firstDataRow = jsonData.find(row => row && row.some(cell => cell && cell.toString().trim() !== ''));
      if (firstDataRow) {
        fileHeaders = firstDataRow.map((_, index) => `Column_${index + 1}`);
      }
    }
    
    const dataStartIndex = headerRowIndex + 1;
    const rows = jsonData.slice(dataStartIndex)
      .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
      .map(row => {
        const obj = {};
        fileHeaders.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

    setHeaders(fileHeaders);
    setSelectedFields(fileHeaders); // По умолчанию выбираем все поля
    setPreviewData(rows.slice(0, previewRows));
  };

  const loadCSVFileForUpload = () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setIsCSV(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length === 0) {
          setError('CSV файл пуст');
          setLoading(false);
          return;
        }

        // Парсим CSV
        const parsedData = lines.map(line => {
          // Простой парсинг CSV (можно улучшить)
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          return values;
        });

        setRawData(parsedData);
        processCSVDataForUpload(parsedData, headerRow);
        setLoading(false);
      } catch (err) {
        setError('Ошибка при чтении CSV файла: ' + err.message);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Ошибка при чтении файла');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const processCSVDataForUpload = (parsedData, headerRowNum) => {
    const headerRowIndex = headerRowNum - 1;
    
    let fileHeaders = [];
    if (headerRowIndex >= 0 && headerRowIndex < parsedData.length) {
      const headerRowData = parsedData[headerRowIndex];
      fileHeaders = headerRowData.map((header, index) => 
        header ? header.toString().trim() : `Column_${index + 1}`
      );
    }
    
    if (fileHeaders.length === 0 || fileHeaders.every(h => !h)) {
      const firstDataRow = parsedData.find(row => row && row.some(cell => cell && cell.toString().trim() !== ''));
      if (firstDataRow) {
        fileHeaders = firstDataRow.map((_, index) => `Column_${index + 1}`);
      }
    }
    
    const dataStartIndex = headerRowIndex + 1;
    const rows = parsedData.slice(dataStartIndex)
      .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
      .map(row => {
        const obj = {};
        fileHeaders.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

    setHeaders(fileHeaders);
    setSelectedFields(fileHeaders); // По умолчанию выбираем все поля
    setCsvData(rows);
    setPreviewData(rows.slice(0, previewRows));
  };

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      loadSheetDataForUpload(workbook, sheetName);
    }
  };

  const handleHeaderRowChange = (value) => {
    const rowNum = parseInt(value);
    if (rowNum >= 1 && rowNum <= rawData.length) {
      setHeaderRow(rowNum);
      if (rawData.length > 0) {
        if (isCSV) {
          processCSVDataForUpload(rawData, rowNum);
        } else {
          processExcelDataForUpload(rawData, rowNum);
        }
      }
    }
  };

  const handleStartRowChange = (value) => {
    const rowNum = parseInt(value);
    if (rowNum >= 1) {
      setStartRow(rowNum);
      updatePreviewData();
    }
  };

  const handleFieldToggle = (field) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleColumnNameChange = (originalName, newName) => {
    setColumnNames(prev => ({
      ...prev,
      [originalName]: newName
    }));
  };

  const getDisplayName = (originalName) => {
    return columnNames[originalName] || originalName;
  };

  const updatePreviewData = () => {
    if (isCSV) {
      const dataStartIndex = headerRow - 1 + startRow;
      const rows = csvData.slice(dataStartIndex - 1)
        .filter(row => row && Object.keys(row).length > 0)
        .map(row => {
          const obj = {};
          selectedFields.forEach((header) => {
            obj[header] = row[header] || '';
          });
          return obj;
        });
      setPreviewData(rows.slice(0, previewRows));
    } else {
      const headerRowIndex = headerRow - 1;
      const dataStartIndex = headerRowIndex + startRow;
      const rows = rawData.slice(dataStartIndex)
        .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
        .map(row => {
          const obj = {};
          selectedFields.forEach((header) => {
            const headerIndex = headers.indexOf(header);
            obj[header] = headerIndex >= 0 ? (row[headerIndex] || '') : '';
          });
          return obj;
        });
      setPreviewData(rows.slice(0, previewRows));
    }
  };

  // Обновляем preview при изменении selectedFields
  useEffect(() => {
    if (selectedFields.length > 0 && (rawData.length > 0 || csvData.length > 0)) {
      updatePreviewData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFields]);

  const handlePreviewRowsChange = (value) => {
    const rowsNum = parseInt(value);
    if (rowsNum >= 1 && rowsNum <= 100) {
      setPreviewRows(rowsNum);
      if (rawData.length > 0) {
        const headerRowIndex = headerRow - 1;
        const dataStartIndex = headerRowIndex + 1;
        const rows = rawData.slice(dataStartIndex)
          .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
          .map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          });
        setPreviewData(rows.slice(0, rowsNum));
      }
    }
  };

  const handleUploadClick = async () => {
    if (!file) {
      setError('Файл не выбран');
      return;
    }

    if (!isCSV && !selectedSheet) {
      setError('Выберите лист для загрузки');
      return;
    }

    if (selectedFields.length === 0) {
      setError('Выберите хотя бы одно поле для загрузки');
      return;
    }

    // Формируем data_schema
    const dataSchema = {
      headers: selectedFields,
      columnNames: columnNames,
      startRow: startRow,
      headerRow: headerRow,
      totalRows: isCSV ? csvData.length : rawData.length - headerRow,
      fileName: file.name || file.original_filename || file.filename || 'unknown',
      excelSheet: selectedSheet || null,
      availableSheets: excelSheets,
      isTransposed: false
    };

    const uploadSettings = {
      sheet: selectedSheet,
      headerRow: headerRow,
      startRow: startRow,
      headers: selectedFields,
      columnNames: columnNames,
      dataSchema: dataSchema
    };

    if (onUpload) {
      await onUpload(file, uploadSettings);
    }
  };

  const loadExcelSheetForView = (wb, sheetName) => {
    const worksheet = wb.Sheets[sheetName];
    if (!worksheet) {
      setError(`Лист "${sheetName}" не найден`);
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (jsonData.length === 0) {
      setHeaders([]);
      setPreviewData([]);
      return;
    }

    const fileHeaders = jsonData[0].map((header, index) =>
      header != null && String(header).trim() !== ''
        ? String(header).trim()
        : `Column_${index + 1}`
    );

    const rows = jsonData.slice(1)
      .filter(row => row && row.some(cell => cell != null && String(cell).trim() !== ''))
      .map(row => {
        const obj = {};
        fileHeaders.forEach((header, index) => {
          obj[header] = row[index] != null ? row[index] : '';
        });
        return obj;
      });

    setHeaders(fileHeaders);
    setPreviewData(rows.slice(0, 100));
    setPreviewRows(Math.min(rows.length, 100));
  };

  const loadExcelForView = async () => {
    try {
      const blob = await dataModelService.downloadModelFile(modelId, file);
      if (!blob || blob.size === 0) {
        throw new Error('Файл пуст или поврежден');
      }

      const arrayBuffer = await blob.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      viewWorkbookRef.current = wb;

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('Файл не содержит листов');
      }

      setExcelSheets(wb.SheetNames);
      const firstSheet = wb.SheetNames[0];
      setSelectedSheet(firstSheet);
      loadExcelSheetForView(wb, firstSheet);
    } catch (err) {
      throw new Error(`Не удалось загрузить Excel файл: ${err.message}`);
    }
  };

  const handleViewSheetChange = (sheetName) => {
    setSelectedSheet(sheetName);
    const wb = viewWorkbookRef.current;
    if (!wb) return;

    if (contentType === 'table' && file?.data_schema?.headers) {
      const schema = file.data_schema;
      const worksheet = wb.Sheets[sheetName];
      if (!worksheet) return;

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = schema.headers || [];
      const selectedFields = schema.selectedFields || headers;
      const columnNames = schema.columnNames || {};
      const headerRowIndex = (schema.headerRow || 1) - 1;
      const dataStartIndex = headerRowIndex + (schema.startRow || 1);

      const data = jsonData.slice(dataStartIndex)
        .filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))
        .map(row => {
          const obj = {};
          selectedFields.forEach((field) => {
            const headerIndex = headers.indexOf(field);
            const displayName = columnNames[field] || field;
            obj[displayName] = headerIndex >= 0 ? (row[headerIndex] || '') : '';
          });
          return obj;
        });

      setHeaders(selectedFields.map(f => columnNames[f] || f));
      setPreviewData(data.slice(0, 100));
      setPreviewRows(Math.min(data.length, 100));
    } else {
      loadExcelSheetForView(wb, sheetName);
    }
  };

  const loadDocxContent = async () => {
    try {
      const blob = await dataModelService.downloadModelFile(modelId, file);
      if (!blob || blob.size === 0) {
        throw new Error('Файл пуст или поврежден');
      }

      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setContent(result.value);
    } catch (err) {
      throw new Error(`Не удалось загрузить DOCX файл: ${err.message}`);
    }
  };

  const loadPdfContent = async () => {
    try {
      const blob = await dataModelService.downloadModelFile(modelId, file);
      if (!blob || blob.size === 0) {
        throw new Error('Файл пуст или поврежден');
      }

      const pdfBlob = blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      setContent(url);
    } catch (err) {
      throw new Error(`Не удалось загрузить PDF файл: ${err.message}`);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await dataModelService.downloadModelFile(modelId, file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename || file.filename || file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Ошибка при скачивании файла');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderSheetSelector = () => {
    if (excelSheets.length <= 1) return null;

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-gray-300">
          Лист:
        </label>
        <select
          value={selectedSheet}
          onChange={(e) => handleViewSheetChange(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {excelSheets.map((sheet) => (
            <option key={sheet} value={sheet}>
              {sheet}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderDataTable = (tableHeaders) => (
    <div className="overflow-x-auto border border-gray-600 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-800">
            {tableHeaders.map((header, index) => (
              <th
                key={index}
                className="px-4 py-2 text-left border-b border-gray-600 text-sm font-semibold text-gray-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-700 hover:bg-gray-800/50"
            >
              {tableHeaders.map((header, colIndex) => (
                <td
                  key={colIndex}
                  className="px-4 py-2 text-sm text-gray-300"
                >
                  {row[header] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // file icons: see <FileTypeIcon />

  if (!isOpen || !file) {
        return null;
  }

  const filename = file.name || file.original_filename || file.filename || 'Без имени';
  const isExcel = isUploadMode && isExcelFile(file);
  const isCSVFile = isUploadMode && isCSV;

  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl max-h-[85vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-cyan-300"><FileTypeIcon filename={filename} size={26} /></span>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isUploadMode ? (isCSVFile ? 'Настройка загрузки CSV файла' : 'Настройка загрузки Excel файла') : filename}
              </h2>
              <p className="text-sm text-gray-400">
                {isUploadMode ? filename : `${file.file_size ? formatFileSize(file.file_size) : 'Размер неизвестен'} • ${file.role || 'data'}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isUploadMode && (
              <button
                onClick={handleDownload}
                className="btn btn-secondary btn-sm"
                title="Скачать файл"
                disabled={loading}
              >
                <ArrowDownTrayIcon style={{ width: '1rem', height: '1rem' }} />
              </button>
            )}
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              disabled={false}
            >
              <XMarkIcon style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3">{isUploadMode ? 'Загрузка файла...' : 'Загрузка содержимого файла...'}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Excel/CSV Upload Settings Mode */}
          {!loading && !error && (isExcel || isCSVFile) && (workbook || isCSVFile) && (
            <div className="space-y-6">
              {/* Sheet Selection (only for Excel) */}
              {isExcel && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Выберите лист:
                  </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    {excelSheets.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Строка с заголовками:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={rawData.length}
                    value={headerRow}
                    onChange={(e) => handleHeaderRowChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Начать с строки данных:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={startRow}
                    onChange={(e) => handleStartRowChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Строк для предпросмотра:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={previewRows}
                    onChange={(e) => handlePreviewRowsChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Field Selection */}
              {headers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Выбор полей для загрузки</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto p-4 bg-gray-800/50 rounded-lg">
                    {headers.map((header, index) => (
                      <div key={`field-${index}-${header}`} className="flex items-center gap-3 p-2 hover:bg-gray-700/50 rounded">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={selectedFields.includes(header)}
                            onChange={() => handleFieldToggle(header)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">{getDisplayName(header)}</span>
                        </label>
                        <input
                          type="text"
                          value={columnNames[header] || ''}
                          onChange={(e) => handleColumnNameChange(header, e.target.value)}
                          placeholder={header}
                          className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Выбрано полей: {selectedFields.length} из {headers.length}
                  </p>
                </div>
              )}

              {/* Preview Table */}
              {selectedFields.length > 0 && previewData.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Предварительный просмотр (первые {previewRows} строк)
                  </h3>
                  <div className="overflow-x-auto border border-gray-600 rounded-lg">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-800">
                          {selectedFields.map((header, index) => (
                            <th
                              key={index}
                              className="px-4 py-2 text-left border-b border-gray-600 text-sm font-semibold text-gray-300"
                            >
                              {getDisplayName(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="border-b border-gray-700 hover:bg-gray-800/50"
                          >
                            {selectedFields.map((header, colIndex) => (
                              <td
                                key={colIndex}
                                className="px-4 py-2 text-sm text-gray-300"
                              >
                                {row[header] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Показано {previewData.length} строк из {isCSVFile ? csvData.length : rawData.length - headerRow} доступных
                  </p>
                </div>
              )}

              {headers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-400">
                  <p>Нет данных для отображения</p>
                </div>
              )}
            </div>
          )}

          {/* Table Preview Mode (based on data_schema) */}
          {!loading && !error && !isExcel && !isUploadMode && contentType === 'table' && (
            <div className="h-full overflow-auto">
              {renderSheetSelector()}
              {previewData.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Данные файла</h3>
                    <p className="text-sm text-gray-400">
                      Показано {previewData.length} строк
                      {file.data_schema?.totalRows && file.data_schema.totalRows > previewData.length &&
                        ` из ${file.data_schema.totalRows}`
                      }
                    </p>
                  </div>
                  {renderDataTable(headers)}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Нет данных для отображения</p>
                </div>
              )}
            </div>
          )}

          {/* Excel view mode with sheet switcher */}
          {!loading && !error && !isExcel && !isUploadMode && contentType === 'excel-view' && (
            <div className="h-full overflow-auto">
              {renderSheetSelector()}
              {previewData.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Предпросмотр Excel</h3>
                    <p className="text-sm text-gray-400">
                      Показано {previewData.length} строк
                      {selectedSheet && excelSheets.length > 1 && ` • лист «${selectedSheet}»`}
                    </p>
                  </div>
                  {renderDataTable(headers)}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Нет данных для отображения</p>
                </div>
              )}
            </div>
          )}

          {/* Regular Preview Mode */}
          {!loading && !error && !isExcel && !isUploadMode && contentType !== 'table' && contentType !== 'excel-view' && content && (
            <div className="h-full overflow-auto">
              {contentType === 'pdf' ? (
                <iframe
                  src={content}
                  className="w-full min-h-[65vh] border-0 rounded-lg bg-white"
                  title="PDF Preview"
                />
              ) : contentType === 'docx' ? (
                <div
                  className="docx-preview p-6 bg-white text-gray-900 rounded-lg prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <pre className="p-6 text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {content}
                </pre>
              )}
            </div>
          )}

          {!loading && !error && !isExcel && !isUploadMode && !content && contentType === 'binary' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <DocumentTextIcon 
                  style={{ width: '3rem', height: '3rem' }} 
                  className="text-gray-500 mx-auto mb-4" 
                />
                <p className="text-gray-400 mb-4">
                  Предварительный просмотр недоступен для этого типа файла
                </p>
                <button
                  onClick={handleDownload}
                  className="btn btn-primary"
                >
                  <ArrowDownTrayIcon style={{ width: '1rem', height: '1rem' }} />
                  Скачать файл
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isUploadMode && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Отмена
            </button>
            <button
              onClick={handleUploadClick}
              disabled={loading || (!isCSVFile && !selectedSheet) || selectedFields.length === 0}
              className="btn btn-primary"
            >
              <CheckIcon style={{ width: '1rem', height: '1rem' }} />
              Загрузить файл
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreviewModal;
