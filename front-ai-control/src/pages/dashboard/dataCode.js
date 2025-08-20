// DataCode language support for CodeMirror
import { LanguageSupport, LRLanguage } from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';
import { completeFromList } from '@codemirror/autocomplete';

// Define DataCode keywords
const dataCodeKeywords = [
  'global', 'local', 'function', 'endfunction', 'if', 'else', 'endif',
  'for', 'forend', 'in', 'do', 'try', 'catch', 'endtry', 'finally',
  'throw', 'return', 'and', 'or', 'not', 'true', 'false', 'null'
];

// Define DataCode built-in functions organized by category
const systemFunctions = [
  'now', 'print', 'getcwd', 'isinstance', 'isset', 'str'
];

const fileFunctions = [
  'path', 'list_files', 'read_file', 'analyze_csv', 'read_csv_safe'
];

const mathFunctions = [
  'abs', 'sqrt', 'pow', 'min', 'max', 'round', 'div'
];

const arrayFunctions = [
  'length', 'len', 'push', 'pop', 'append', 'sort', 'unique', 'array',
  'sum', 'average', 'count', 'range', 'map', 'filter', 'reduce',
  'array_builder', 'extend', 'bulk_create'
];

const stringFunctions = [
  'split', 'join', 'trim', 'upper', 'lower', 'contains'
];

const tableFunctions = [
  'table', 'table_create', 'show_table', 'table_info', 'table_head',
  'table_tail', 'table_headers', 'table_select', 'table_sort', 'table_where',
  'table_join', 'table_union', 'table_subtract', 'table_intersect',
  'table_unique', 'table_drop_duplicates', 'table_group_by'
];

const filterFunctions = [
  'table_filter', 'table_query', 'table_distinct', 'table_sample',
  'table_between', 'table_in', 'table_is_null', 'table_not_null'
];

const iterationFunctions = ['enum'];

// Combine all built-in functions
const allBuiltinFunctions = [
  ...systemFunctions,
  ...fileFunctions,
  ...mathFunctions,
  ...arrayFunctions,
  ...stringFunctions,
  ...tableFunctions,
  ...filterFunctions,
  ...iterationFunctions
];

// Define data types
const dataTypes = [
  'integer', 'float', 'string', 'boolean', 'array', 'table', 'path',
  'date', 'currency', 'null'
];

// Create a comprehensive parser for DataCode syntax highlighting
const dataCodeLanguage = LRLanguage.define({
  name: 'datacode',
  parser: {
    parse: (input) => {
      const tokens = [];
      let pos = 0;
      let line = 1;
      let column = 1;

      // Helper function to advance position
      const advance = (count = 1) => {
        for (let i = 0; i < count; i++) {
          if (input[pos] === '\n') {
            line++;
            column = 1;
          } else {
            column++;
          }
          pos++;
        }
      };

      // Helper function to peek ahead
      const peek = (offset = 0) => input[pos + offset] || '';

      // Helper function to match string at current position
      const match = (str) => input.substr(pos, str.length) === str;

      while (pos < input.length) {
        const char = peek();

        // Skip whitespace but track position
        if (/\s/.test(char)) {
          advance();
          continue;
        }

        // Line comments
        if (char === '#') {
          const start = pos;
          while (pos < input.length && peek() !== '\n') advance();
          tokens.push({ type: 'comment', start, end: pos, line, column });
          continue;
        }

        // Block comments with proper nesting support
        if (match('"""')) {
          const start = pos;
          advance(3); // Skip opening """
          let depth = 1;
          while (pos < input.length && depth > 0) {
            if (match('"""')) {
              if (peek(-1) !== '\\') { // Not escaped
                depth--;
                if (depth > 0) advance(3);
              }
            }
            if (depth > 0) advance();
          }
          if (depth === 0) advance(3); // Skip closing """
          tokens.push({ type: 'comment', start, end: pos, line, column });
          continue;
        }

        // String literals with escape sequence support
        if (char === '"' || char === "'") {
          const quote = char;
          const start = pos;
          advance(); // Skip opening quote

          while (pos < input.length && peek() !== quote) {
            if (peek() === '\\') {
              advance(2); // Skip escape sequence
            } else {
              advance();
            }
          }

          if (pos < input.length) advance(); // Skip closing quote
          tokens.push({ type: 'string', start, end: pos, line, column });
          continue;
        }

        // Numbers with float support
        if (/\d/.test(char) || (char === '.' && /\d/.test(peek(1)))) {
          const start = pos;
          let hasDecimal = false;

          while (pos < input.length) {
            const c = peek();
            if (/\d/.test(c)) {
              advance();
            } else if (c === '.' && !hasDecimal && /\d/.test(peek(1))) {
              hasDecimal = true;
              advance();
            } else {
              break;
            }
          }

          tokens.push({ type: 'number', start, end: pos, line, column });
          continue;
        }

        // Identifiers, keywords, and built-in functions
        if (/[a-zA-Z_]/.test(char)) {
          const start = pos;
          while (pos < input.length && /[a-zA-Z0-9_]/.test(peek())) advance();

          const word = input.substring(start, pos);
          let type = 'identifier';

          // Check for keywords first (highest priority)
          if (dataCodeKeywords.includes(word)) {
            type = 'keyword';
          }
          // Check for built-in functions
          else if (allBuiltinFunctions.includes(word)) {
            // Look ahead to see if this is followed by parentheses
            let nextPos = pos;
            while (nextPos < input.length && /\s/.test(input[nextPos])) nextPos++;
            if (input[nextPos] === '(') {
              type = 'builtin-function';
            } else {
              type = 'builtin';
            }
          }
          // Check for data types
          else if (dataTypes.includes(word)) {
            type = 'type';
          }
          // Check if it's a function call (identifier followed by parentheses)
          else {
            let nextPos = pos;
            while (nextPos < input.length && /\s/.test(input[nextPos])) nextPos++;
            if (input[nextPos] === '(') {
              type = 'function-call';
            }
          }

          tokens.push({ type, start, end: pos, word, line, column });
          continue;
        }

        // Multi-character operators
        const twoChar = input.substr(pos, 2);
        const threeChar = input.substr(pos, 3);

        // Three-character operators
        if (['**='].includes(threeChar)) {
          tokens.push({ type: 'operator', start: pos, end: pos + 3, line, column });
          advance(3);
          continue;
        }

        // Two-character operators
        const operators2 = ['==', '!=', '<=', '>=', '**', '+=', '-=', '*=', '/=', '%='];
        if (operators2.includes(twoChar)) {
          tokens.push({ type: 'operator', start: pos, end: pos + 2, line, column });
          advance(2);
          continue;
        }

        // Single-character operators
        const operators1 = ['+', '-', '*', '/', '%', '<', '>', '=', '!'];
        if (operators1.includes(char)) {
          tokens.push({ type: 'operator', start: pos, end: pos + 1, line, column });
          advance();
          continue;
        }

        // Punctuation and delimiters
        const punctuation = ['(', ')', '[', ']', '{', '}', ',', ':', ';'];
        if (punctuation.includes(char)) {
          tokens.push({ type: 'punctuation', start: pos, end: pos + 1, line, column });
          advance();
          continue;
        }

        // Path separator (special case for DataCode)
        if (char === '.' || char === '/') {
          tokens.push({ type: 'path-separator', start: pos, end: pos + 1, line, column });
          advance();
          continue;
        }

        // Unknown character - skip it
        advance();
      }

      return { tokens };
    }
  },
  languageData: {
    commentTokens: { line: '#', block: { open: '"""', close: '"""' } },
    indentOnInput: /^\s*(endif|endfunction|forend|endtry|else|catch|finally)$/,
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    wordChars: '$'
  }
});

// Apply comprehensive syntax highlighting styles
const dataCodeHighlighting = styleTags({
  // Keywords (control flow, declarations)
  'keyword': t.keyword,

  // Built-in functions (different styles for different categories)
  'builtin': t.function(t.variableName),
  'builtin-function': t.function(t.variableName),

  // Data types
  'type': t.typeName,

  // Identifiers and function calls
  'identifier': t.variableName,
  'function-call': t.function(t.variableName),

  // Literals
  'string': t.string,
  'number': t.number,

  // Comments
  'comment': t.comment,

  // Operators
  'operator': t.operator,

  // Punctuation and delimiters
  'punctuation': t.punctuation,
  'path-separator': t.operator
});

// Create comprehensive autocompletion with function signatures
const dataCodeCompletions = completeFromList([
  // Keywords with detailed info
  ...dataCodeKeywords.map(kw => ({
    label: kw,
    type: 'keyword',
    info: getKeywordInfo(kw)
  })),

  // System functions with signatures
  ...systemFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getSystemFunctionInfo(fn),
    detail: getSystemFunctionSignature(fn)
  })),

  // File functions with signatures
  ...fileFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getFileFunctionInfo(fn),
    detail: getFileFunctionSignature(fn)
  })),

  // Math functions with signatures
  ...mathFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getMathFunctionInfo(fn),
    detail: getMathFunctionSignature(fn)
  })),

  // Array functions with signatures
  ...arrayFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getArrayFunctionInfo(fn),
    detail: getArrayFunctionSignature(fn)
  })),

  // String functions with signatures
  ...stringFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getStringFunctionInfo(fn),
    detail: getStringFunctionSignature(fn)
  })),

  // Table functions with signatures
  ...tableFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getTableFunctionInfo(fn),
    detail: getTableFunctionSignature(fn)
  })),

  // Filter functions with signatures
  ...filterFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getFilterFunctionInfo(fn),
    detail: getFilterFunctionSignature(fn)
  })),

  // Iteration functions with signatures
  ...iterationFunctions.map(fn => ({
    label: fn,
    type: 'function',
    info: getIterationFunctionInfo(fn),
    detail: getIterationFunctionSignature(fn)
  })),

  // Data types with descriptions
  ...dataTypes.map(type => ({
    label: type,
    type: 'type',
    info: getDataTypeInfo(type)
  }))
]);

// Enhanced function info helpers with detailed descriptions and signatures

// Keyword information
function getKeywordInfo(kw) {
  const info = {
    'global': 'Declares a global variable accessible throughout the program',
    'local': 'Declares a local variable with limited scope',
    'function': 'Defines a user-defined function',
    'endfunction': 'Ends a function definition',
    'if': 'Starts a conditional statement',
    'else': 'Alternative branch in conditional statement',
    'endif': 'Ends a conditional statement',
    'for': 'Starts a loop over an iterable',
    'forend': 'Ends a for loop',
    'in': 'Used in for loops to iterate over collections',
    'do': 'Marks the beginning of a code block',
    'try': 'Starts exception handling block',
    'catch': 'Handles exceptions in try block',
    'endtry': 'Ends exception handling block',
    'finally': 'Code that always executes after try/catch',
    'throw': 'Throws an exception',
    'return': 'Returns a value from a function',
    'and': 'Logical AND operator',
    'or': 'Logical OR operator',
    'not': 'Logical NOT operator',
    'true': 'Boolean true literal',
    'false': 'Boolean false literal',
    'null': 'Null value literal'
  };
  return info[kw] || '';
}

// System function information and signatures
function getSystemFunctionInfo(fn) {
  const info = {
    'now': 'Returns current date and time in RFC3339 format',
    'print': 'Outputs values to console, separated by spaces',
    'getcwd': 'Returns current working directory as path object',
    'isinstance': 'Checks if value is of specified type',
    'isset': 'Checks if variable is defined and not null',
    'str': 'Converts value to string representation'
  };
  return info[fn] || '';
}

function getSystemFunctionSignature(fn) {
  const signatures = {
    'now': 'now() -> string',
    'print': 'print(...values) -> null',
    'getcwd': 'getcwd() -> path',
    'isinstance': 'isinstance(value, type) -> boolean',
    'isset': 'isset(variable) -> boolean',
    'str': 'str(value) -> string'
  };
  return signatures[fn] || '';
}

// File function information and signatures
function getFileFunctionInfo(fn) {
  const info = {
    'path': 'Creates path object from string',
    'list_files': 'Returns list of files in directory or by glob pattern',
    'read_file': 'Reads file content or creates table for CSV/Excel',
    'analyze_csv': 'Analyzes CSV file structure',
    'read_csv_safe': 'Safely reads CSV file with error handling'
  };
  return info[fn] || '';
}

function getFileFunctionSignature(fn) {
  const signatures = {
    'path': 'path(string_path) -> path',
    'list_files': 'list_files(directory_path) -> array',
    'read_file': 'read_file(file_path) -> string|table',
    'analyze_csv': 'analyze_csv(file_path) -> object',
    'read_csv_safe': 'read_csv_safe(file_path) -> table'
  };
  return signatures[fn] || '';
}

// Math function information and signatures
function getMathFunctionInfo(fn) {
  const info = {
    'abs': 'Returns absolute value',
    'sqrt': 'Returns square root',
    'pow': 'Returns base raised to exponent',
    'min': 'Returns minimum value from arguments',
    'max': 'Returns maximum value from arguments',
    'round': 'Rounds number to specified decimal places',
    'div': 'Performs division'
  };
  return info[fn] || '';
}

function getMathFunctionSignature(fn) {
  const signatures = {
    'abs': 'abs(number) -> number',
    'sqrt': 'sqrt(number) -> number',
    'pow': 'pow(base, exponent) -> number',
    'min': 'min(...numbers) -> number',
    'max': 'max(...numbers) -> number',
    'round': 'round(number, decimals?) -> number',
    'div': 'div(dividend, divisor) -> number'
  };
  return signatures[fn] || '';
}

// Array function information and signatures
function getArrayFunctionInfo(fn) {
  const info = {
    'length': 'Returns length of array or string',
    'len': 'Alias for length function',
    'push': 'Adds element to end of array',
    'pop': 'Removes and returns last element',
    'append': 'Adds element to array',
    'sort': 'Sorts array elements',
    'unique': 'Returns unique elements from array',
    'array': 'Creates array from arguments',
    'sum': 'Returns sum of numeric array',
    'average': 'Returns average of numeric array',
    'count': 'Returns count of elements',
    'range': 'Creates array of numbers in range',
    'map': 'Applies function to each element',
    'filter': 'Filters array by predicate',
    'reduce': 'Reduces array to single value',
    'array_builder': 'Builds array using generator function',
    'extend': 'Extends array with elements from another',
    'bulk_create': 'Creates array with repeated values'
  };
  return info[fn] || '';
}

function getArrayFunctionSignature(fn) {
  const signatures = {
    'length': 'length(array|string) -> number',
    'len': 'len(array|string) -> number',
    'push': 'push(array, element) -> array',
    'pop': 'pop(array) -> any',
    'append': 'append(array, element) -> array',
    'sort': 'sort(array) -> array',
    'unique': 'unique(array) -> array',
    'array': 'array(...elements) -> array',
    'sum': 'sum(array) -> number',
    'average': 'average(array) -> number',
    'count': 'count(array) -> number',
    'range': 'range(start, end, step?) -> array',
    'map': 'map(array, function) -> array',
    'filter': 'filter(array, predicate) -> array',
    'reduce': 'reduce(array, function, initial?) -> any',
    'array_builder': 'array_builder(size, generator) -> array',
    'extend': 'extend(array, other_array) -> array',
    'bulk_create': 'bulk_create(count, value) -> array'
  };
  return signatures[fn] || '';
}

// String function information and signatures
function getStringFunctionInfo(fn) {
  const info = {
    'split': 'Splits string by delimiter',
    'join': 'Joins array elements with delimiter',
    'trim': 'Removes whitespace from string',
    'upper': 'Converts string to uppercase',
    'lower': 'Converts string to lowercase',
    'contains': 'Checks if string contains substring'
  };
  return info[fn] || '';
}

function getStringFunctionSignature(fn) {
  const signatures = {
    'split': 'split(string, delimiter) -> array',
    'join': 'join(array, delimiter) -> string',
    'trim': 'trim(string) -> string',
    'upper': 'upper(string) -> string',
    'lower': 'lower(string) -> string',
    'contains': 'contains(string, substring) -> boolean'
  };
  return signatures[fn] || '';
}

// Table function information and signatures
function getTableFunctionInfo(fn) {
  const info = {
    'table': 'Creates table from data and headers',
    'table_create': 'Creates new table',
    'show_table': 'Displays table contents',
    'table_info': 'Returns table information',
    'table_head': 'Returns first n rows',
    'table_tail': 'Returns last n rows',
    'table_headers': 'Returns table headers',
    'table_select': 'Selects specific columns',
    'table_sort': 'Sorts table by column',
    'table_where': 'Filters table by condition',
    'table_join': 'Joins two tables',
    'table_union': 'Combines tables',
    'table_subtract': 'Subtracts one table from another',
    'table_intersect': 'Returns intersection of tables',
    'table_unique': 'Returns unique rows',
    'table_drop_duplicates': 'Removes duplicate rows',
    'table_group_by': 'Groups table by columns'
  };
  return info[fn] || '';
}

function getTableFunctionSignature(fn) {
  const signatures = {
    'table': 'table(data, headers) -> table',
    'table_create': 'table_create(rows, columns) -> table',
    'show_table': 'show_table(table) -> null',
    'table_info': 'table_info(table) -> object',
    'table_head': 'table_head(table, n) -> table',
    'table_tail': 'table_tail(table, n) -> table',
    'table_headers': 'table_headers(table) -> array',
    'table_select': 'table_select(table, columns) -> table',
    'table_sort': 'table_sort(table, column, ascending?) -> table',
    'table_where': 'table_where(table, column, operator, value) -> table',
    'table_join': 'table_join(table1, table2, key1, key2, type?) -> table',
    'table_union': 'table_union(table1, table2) -> table',
    'table_subtract': 'table_subtract(table1, table2) -> table',
    'table_intersect': 'table_intersect(table1, table2) -> table',
    'table_unique': 'table_unique(table, columns) -> table',
    'table_drop_duplicates': 'table_drop_duplicates(table, columns) -> table',
    'table_group_by': 'table_group_by(table, columns, aggregations) -> table'
  };
  return signatures[fn] || '';
}

// Filter function information and signatures
function getFilterFunctionInfo(fn) {
  const info = {
    'table_filter': 'Filters table with custom condition',
    'table_query': 'Queries table with SQL-like syntax',
    'table_distinct': 'Returns distinct values from column',
    'table_sample': 'Returns random sample of rows',
    'table_between': 'Filters rows with values between range',
    'table_in': 'Filters rows with values in list',
    'table_is_null': 'Filters rows with null values',
    'table_not_null': 'Filters rows with non-null values'
  };
  return info[fn] || '';
}

function getFilterFunctionSignature(fn) {
  const signatures = {
    'table_filter': 'table_filter(table, condition) -> table',
    'table_query': 'table_query(table, query) -> table',
    'table_distinct': 'table_distinct(table, column) -> array',
    'table_sample': 'table_sample(table, n) -> table',
    'table_between': 'table_between(table, column, min, max) -> table',
    'table_in': 'table_in(table, column, values) -> table',
    'table_is_null': 'table_is_null(table, column) -> table',
    'table_not_null': 'table_not_null(table, column) -> table'
  };
  return signatures[fn] || '';
}

// Iteration function information and signatures
function getIterationFunctionInfo(fn) {
  const info = {
    'enum': 'Returns enumerated pairs of index and value'
  };
  return info[fn] || '';
}

function getIterationFunctionSignature(fn) {
  const signatures = {
    'enum': 'enum(array) -> array'
  };
  return signatures[fn] || '';
}

// Data type information
function getDataTypeInfo(type) {
  const info = {
    'integer': 'Whole numbers without decimal points',
    'float': 'Numbers with decimal points',
    'string': 'Text data enclosed in quotes',
    'boolean': 'True or false values',
    'array': 'Ordered collection of elements',
    'table': 'Structured data with rows and columns',
    'path': 'File system path object',
    'date': 'Date and time values',
    'currency': 'Monetary values',
    'null': 'Represents absence of value'
  };
  return info[type] || '';
}

// Export the language support
export function dataCode() {
  return new LanguageSupport(dataCodeLanguage, [dataCodeHighlighting]);
}

export { dataCodeCompletions };
