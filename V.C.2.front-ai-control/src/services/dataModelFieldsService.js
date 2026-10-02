import api from './api';

export const dataModelFieldsService = {
  /**
   * Получение полей всех моделей данных, связанных с дашбордом
   * @param {string} dashboardId - ID дашборда
   * @returns {Promise<Array>} Массив полей всех моделей данных
   */
  async getDashboardDataFields(dashboardId) {
    try {
      // Получаем модели данных дашборда
      const response = await api.get(`/dashboards/${dashboardId}/data-models`);
      const dataModels = response.data.data_models || [];
      
      
      // Извлекаем поля из каждой модели данных
      const allFields = [];
      
      for (const dataModel of dataModels) {
        const fields = this.extractFieldsFromDataModel(dataModel);
        allFields.push(...fields);
      }
      
      return allFields;
    } catch (error) {
      console.error('Error fetching dashboard data fields:', error);
      throw error;
    }
  },

  /**
   * Извлечение полей из модели данных
   * @param {Object} dataModel - Модель данных
   * @returns {Array} Массив полей модели
   */
  extractFieldsFromDataModel(dataModel) {
    const fields = [];
    
    // Метаданные, которые не являются полями данных
    const metadataFields = ['table_name', 'created_from', 'rows', 'columns', 'updated', 'data_schema', 
                            'total_rows', 'fileName', 'excelSheet', 'availableSheets', 'isTransposed',
                            'startRow', 'headerRow', 'columnNames', 'relationships'];
    
    // Извлекаем поля из data_schema
    if (dataModel.data_schema && typeof dataModel.data_schema === 'object') {
      
      // Проверяем, есть ли структура с таблицами (tables)
      if (dataModel.data_schema.tables && typeof dataModel.data_schema.tables === 'object') {
        Object.entries(dataModel.data_schema.tables).forEach(([tableName, tableInfo]) => {
          
          // Извлекаем поля из таблицы
          if (tableInfo.fields && typeof tableInfo.fields === 'object') {
            Object.entries(tableInfo.fields).forEach(([fieldName, fieldInfo]) => {
              let fieldType = fieldInfo.type || 'string';
              // Нормализуем тип: nullable_number → number, nullable_int → int, int → int, number → number
              fieldType = this.normalizeFieldType(fieldType);
              fields.push({
                id: `${dataModel.id}_${tableName}_${fieldName}`,
                name: fieldName,
                type: fieldType,
                description: fieldInfo.description || `${tableInfo.description || ''} - ${fieldName}`.trim(),
                dataModelId: dataModel.id,
                dataModelName: `${dataModel.name} - ${tableName}`,
                dataModelType: dataModel.data_type,
                tableName: tableName,
                source: 'table_fields'
              });
            });
          }
          // Если нет fields, но есть columns (для CSV таблиц)
          else if (tableInfo.columns && Array.isArray(tableInfo.columns)) {
            // Проверяем, есть ли информация о типах полей в tableInfo.fieldTypes
            const fieldTypes = tableInfo.fieldTypes || {};
            
            tableInfo.columns.forEach((columnName) => {
              
              // Используем тип из fieldTypes, если он есть, иначе определяем на основе данных
              let fieldType = fieldTypes[columnName];
              if (!fieldType) {
                // Определяем тип поля на основе данных
                fieldType = 'string';
                if (tableInfo.sample_data && Array.isArray(tableInfo.sample_data)) {
                  // Проверяем несколько значений (до 10) для более точного определения типа
                  const sampleValues = tableInfo.sample_data
                    .slice(0, 10)
                    .map(record => record[columnName])
                    .filter(val => val !== undefined && val !== null);
                  
                  if (sampleValues.length > 0) {
                    // Определяем тип на основе всех проверенных значений
                    const types = sampleValues.map(val => this.inferFieldType(val));
                    // Если все значения одного типа (кроме string), используем этот тип
                    const uniqueTypes = [...new Set(types)];
                    if (uniqueTypes.length === 1 && uniqueTypes[0] !== 'string') {
                      fieldType = uniqueTypes[0];
                    } else if (uniqueTypes.includes('int')) {
                      // Если есть хотя бы одно целое число, используем int
                      fieldType = 'int';
                    } else if (uniqueTypes.includes('number')) {
                      // Если есть хотя бы одно число, используем number
                      fieldType = 'number';
                    } else {
                      // Иначе используем тип первого значения
                      fieldType = types[0];
                    }
                  }
                }
              }
              
              // Нормализуем тип: nullable_number → number, nullable_int → int, int → int, number → number
              fieldType = this.normalizeFieldType(fieldType);
              
              fields.push({
                id: `${dataModel.id}_${tableName}_${columnName}`,
                name: columnName,
                type: fieldType,
                description: `${tableInfo.description || ''} - ${columnName}`.trim(),
                dataModelId: dataModel.id,
                dataModelName: `${dataModel.name} - ${tableName}`,
                dataModelType: dataModel.data_type,
                tableName: tableName,
                source: 'table_columns'
              });
            });
          }
        });
      }
      // Для CSV файлов извлекаем поля из массива headers
      else if (dataModel.data_schema.headers && Array.isArray(dataModel.data_schema.headers)) {
        
        // Проверяем, есть ли информация о типах полей в data_schema.fieldTypes
        const fieldTypes = dataModel.data_schema.fieldTypes || {};
        
        dataModel.data_schema.headers.forEach((fieldName) => {
          // Пропускаем метаданные
          if (metadataFields.includes(fieldName)) {
            return;
          }
          
          
          // Используем тип из data_schema, если он есть, иначе определяем на основе данных
          let fieldType = fieldTypes[fieldName];
          if (!fieldType) {
            // Определяем тип поля на основе данных - проверяем несколько значений для точности
            fieldType = 'string';
            if (dataModel.data_content && dataModel.data_content.sample_data && Array.isArray(dataModel.data_content.sample_data)) {
              // Проверяем несколько значений (до 10) для более точного определения типа
              const sampleValues = dataModel.data_content.sample_data
                .slice(0, 10)
                .map(record => record[fieldName])
                .filter(val => val !== undefined && val !== null);
              
              if (sampleValues.length > 0) {
                // Определяем тип на основе всех проверенных значений
                const types = sampleValues.map(val => this.inferFieldType(val));
                // Если все значения одного типа (кроме string), используем этот тип
                const uniqueTypes = [...new Set(types)];
                if (uniqueTypes.length === 1 && uniqueTypes[0] !== 'string') {
                  fieldType = uniqueTypes[0];
                } else if (uniqueTypes.includes('int')) {
                  // Если есть хотя бы одно целое число, используем int
                  fieldType = 'int';
                } else if (uniqueTypes.includes('number')) {
                  // Если есть хотя бы одно число, используем number
                  fieldType = 'number';
                } else {
                  // Иначе используем тип первого значения
                  fieldType = types[0];
                }
              }
            }
          }
          
          // Нормализуем тип: nullable_number → number, nullable_int → int, int → int, number → number
          fieldType = this.normalizeFieldType(fieldType);
          
          fields.push({
            id: `${dataModel.id}_${fieldName}`,
            name: fieldName,
            type: fieldType,
            description: `Поле из CSV файла ${dataModel.data_source}`,
            dataModelId: dataModel.id,
            dataModelName: dataModel.name,
            dataModelType: dataModel.data_type,
            source: 'headers'
          });
        });
      }
      // Если есть columns (для таблиц из DataCode интерпретатора)
      else if (dataModel.data_schema.columns && Array.isArray(dataModel.data_schema.columns)) {
        const tableName = dataModel.data_schema.table_name || dataModel.name;
        
        // Проверяем, есть ли информация о типах полей в data_schema.fieldTypes
        const fieldTypes = dataModel.data_schema.fieldTypes || {};
        
        dataModel.data_schema.columns.forEach((columnName) => {
          
          // Используем тип из data_schema, если он есть, иначе определяем на основе данных
          let fieldType = fieldTypes[columnName];
          if (!fieldType) {
            // Определяем тип поля на основе данных
            fieldType = 'string';
            if (dataModel.data_content && dataModel.data_content.sample_data && Array.isArray(dataModel.data_content.sample_data)) {
              // Проверяем несколько значений (до 10) для более точного определения типа
              const sampleValues = dataModel.data_content.sample_data
                .slice(0, 10)
                .map(record => record[columnName])
                .filter(val => val !== undefined && val !== null);
              
              if (sampleValues.length > 0) {
                // Определяем тип на основе всех проверенных значений
                const types = sampleValues.map(val => this.inferFieldType(val));
                // Если все значения одного типа (кроме string), используем этот тип
                const uniqueTypes = [...new Set(types)];
                if (uniqueTypes.length === 1 && uniqueTypes[0] !== 'string') {
                  fieldType = uniqueTypes[0];
                } else if (uniqueTypes.includes('int')) {
                  // Если есть хотя бы одно целое число, используем int
                  fieldType = 'int';
                } else if (uniqueTypes.includes('number')) {
                  // Если есть хотя бы одно число, используем number
                  fieldType = 'number';
                } else {
                  // Иначе используем тип первого значения
                  fieldType = types[0];
                }
              }
            }
          }
          
          // Нормализуем тип: nullable_number → number, nullable_int → int, int → int, number → number
          fieldType = this.normalizeFieldType(fieldType);
          
          fields.push({
            id: `${dataModel.id}_${tableName}_${columnName}`,
            name: columnName,
            type: fieldType,
            description: `Поле из таблицы ${tableName}`,
            dataModelId: dataModel.id,
            dataModelName: `${dataModel.name} - ${tableName}`,
            dataModelType: dataModel.data_type,
            tableName: tableName,
            source: 'columns'
          });
        });
      }
      // Проверяем, есть ли вложенное поле 'fields' с реальными полями данных
      else if (dataModel.data_schema.fields && typeof dataModel.data_schema.fields === 'object') {
        Object.entries(dataModel.data_schema.fields).forEach(([fieldName, fieldInfo]) => {
          // Пропускаем метаданные
          if (metadataFields.includes(fieldName)) {
            return;
          }
          
          fields.push({
            id: `${dataModel.id}_${fieldName}`,
            name: fieldName,
            type: fieldInfo.type || 'string',
            description: fieldInfo.description || '',
            dataModelId: dataModel.id,
            dataModelName: dataModel.name,
            dataModelType: dataModel.data_type,
            source: 'schema'
          });
        });
      } else {
        // Обрабатываем поля верхнего уровня только если это не CSV файл и не метаданные
        if (dataModel.data_type !== 'file' || !dataModel.data_source?.endsWith('.csv')) {
          Object.entries(dataModel.data_schema).forEach(([fieldName, fieldInfo]) => {
            // Пропускаем метаданные
            if (metadataFields.includes(fieldName)) {
              return;
            }
            
            // Пропускаем вложенные объекты, которые не являются полями
            if (typeof fieldInfo === 'object' && !Array.isArray(fieldInfo) && fieldInfo !== null) {
              // Проверяем, является ли это описанием поля (имеет type или description)
              if (!fieldInfo.type && !fieldInfo.description && !Array.isArray(fieldInfo)) {
                return;
              }
            }
            
            fields.push({
              id: `${dataModel.id}_${fieldName}`,
              name: fieldName,
              type: (typeof fieldInfo === 'object' && fieldInfo.type) ? fieldInfo.type : 'string',
              description: (typeof fieldInfo === 'object' && fieldInfo.description) ? fieldInfo.description : '',
              dataModelId: dataModel.id,
              dataModelName: dataModel.name,
              dataModelType: dataModel.data_type,
              source: 'schema'
            });
          });
        }
      }
    }
    
    // Извлекаем поля из data_content (если есть данные)
    if (dataModel.data_content) {
      
      // Если data_content это массив
      if (Array.isArray(dataModel.data_content) && dataModel.data_content.length > 0) {
        const sampleRecord = dataModel.data_content[0];
        Object.keys(sampleRecord).forEach(fieldName => {
          // Проверяем, не добавлено ли уже поле из схемы
          const existingField = fields.find(f => f.name === fieldName && f.dataModelId === dataModel.id);
          if (!existingField) {
            const fieldValue = sampleRecord[fieldName];
            fields.push({
              id: `${dataModel.id}_${fieldName}`,
              name: fieldName,
              type: this.inferFieldType(fieldValue),
              description: `Поле из данных модели ${dataModel.name}`,
              dataModelId: dataModel.id,
              dataModelName: dataModel.name,
              dataModelType: dataModel.data_type,
              source: 'content'
            });
          }
        });
      }
      // Если data_content это объект (не массив)
      else if (typeof dataModel.data_content === 'object' && !Array.isArray(dataModel.data_content)) {
        
        // Проверяем, есть ли sample_data с реальными записями
        if (dataModel.data_content.sample_data && Array.isArray(dataModel.data_content.sample_data) && dataModel.data_content.sample_data.length > 0) {
          const sampleRecord = dataModel.data_content.sample_data[0];
          Object.keys(sampleRecord).forEach(fieldName => {
            const existingField = fields.find(f => f.name === fieldName && f.dataModelId === dataModel.id);
            if (!existingField) {
              const fieldValue = sampleRecord[fieldName];
              fields.push({
                id: `${dataModel.id}_${fieldName}`,
                name: fieldName,
                type: this.inferFieldType(fieldValue),
                description: `Поле из данных модели ${dataModel.name}`,
                dataModelId: dataModel.id,
                dataModelName: dataModel.name,
                dataModelType: dataModel.data_type,
                source: 'content'
              });
            }
          });
        } else {
          // Обрабатываем поля верхнего уровня объекта
          Object.keys(dataModel.data_content).forEach(fieldName => {
            const existingField = fields.find(f => f.name === fieldName && f.dataModelId === dataModel.id);
            if (!existingField) {
              const fieldValue = dataModel.data_content[fieldName];
              fields.push({
                id: `${dataModel.id}_${fieldName}`,
                name: fieldName,
                type: this.inferFieldType(fieldValue),
                description: `Поле из данных модели ${dataModel.name}`,
                dataModelId: dataModel.id,
                dataModelName: dataModel.name,
                dataModelType: dataModel.data_type,
                source: 'content'
              });
            }
          });
        }
      }
    }
    
    return fields;
  },

  /**
   * Нормализация типа поля
   * @param {string} fieldType - Тип поля
   * @returns {string} Нормализованный тип поля
   */
  normalizeFieldType(fieldType) {
    if (!fieldType || typeof fieldType !== 'string') {
      return 'string';
    }
    
    const lower = fieldType.toLowerCase();
    
    // Обрабатываем nullable типы (nullable_int, nullable_number, и т.д.)
    if (lower.startsWith('nullable_')) {
      const baseType = lower.replace('nullable_', '');
      if (baseType.includes('number') || baseType.includes('int') || baseType.includes('float') || baseType.includes('decimal')) {
        // Если это int, возвращаем int, иначе number
        if (baseType === 'int' || baseType.includes('int')) {
          return 'int';
        }
        return 'number';
      }
      if (baseType.includes('date') || baseType.includes('time') || baseType.includes('datetime')) {
        return 'date';
      }
      return 'string';
    }
    
    // Обрабатываем обычные типы
    if (lower === 'int' || lower === 'integer') {
      return 'int';
    }
    if (lower === 'number' || lower === 'float' || lower === 'double' || lower === 'decimal') {
      return 'number';
    }
    if (lower === 'boolean' || lower === 'bool') {
      return 'boolean';
    }
    if (lower.includes('date') || lower.includes('time')) {
      return 'date';
    }
    
    return 'string';
  },

  /**
   * Определение типа поля по значению
   * @param {*} value - Значение поля
   * @returns {string} Тип поля
   */
  inferFieldType(value) {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'number') {
      // Если число целое, возвращаем 'int', иначе 'number'
      return Number.isInteger(value) ? 'int' : 'number';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      // Проверяем, является ли строка целым числом
      const trimmedValue = value.trim();
      if (trimmedValue !== '' && /^-?\d+$/.test(trimmedValue)) {
        return 'int';
      }
      // Проверяем, является ли строка числом (с плавающей точкой)
      if (trimmedValue !== '' && !isNaN(trimmedValue) && !isNaN(parseFloat(trimmedValue))) {
        return 'number';
      }
      // Проверяем, является ли строка датой
      if (this.isDateString(value)) return 'date';
      // Проверяем, является ли строка email
      if (this.isEmailString(value)) return 'email';
      // Проверяем, является ли строка URL
      if (this.isUrlString(value)) return 'url';
      return 'string';
    }
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  },

  /**
   * Проверка, является ли строка датой
   * @param {string} str - Строка для проверки
   * @returns {boolean}
   */
  isDateString(str) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    return dateRegex.test(str) && !isNaN(Date.parse(str));
  },

  /**
   * Проверка, является ли строка email
   * @param {string} str - Строка для проверки
   * @returns {boolean}
   */
  isEmailString(str) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str);
  },

  /**
   * Проверка, является ли строка URL
   * @param {string} str - Строка для проверки
   * @returns {boolean}
   */
  isUrlString(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Получение иконки для типа поля
   * @param {string} fieldType - Тип поля
   * @returns {string} Эмодзи иконка
   */
  getFieldTypeIcon(fieldType) {
    const icons = {
      string: '📝',
      number: '🔢',
      boolean: '✅',
      date: '📅',
      email: '📧',
      url: '🔗',
      array: '📋',
      object: '📦',
      default: '📄'
    };
    return icons[fieldType] || icons.default;
  }
};
