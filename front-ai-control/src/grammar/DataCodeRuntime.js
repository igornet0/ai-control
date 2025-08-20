import { parser } from '../parsers/dataCode.js';

export class DataCodeRuntime {
  constructor(globals = {}) {
    this.globals = { ...globals };
    this.locals = {};
    this.functions = {};
    this.returnValue = undefined;
  }

  run(code) {
    const tree = parser.parse(code);
    this.execStatements(tree.topNode.children);
    return {
      globals: this.globals,
      locals: this.locals,
      return: this.returnValue
    };
  }

  execStatements(stmts) {
    for (let stmt of stmts) {
      this.exec(stmt);
      if (this.returnValue !== undefined) break;
    }
  }

  exec(node) {
    const type = node.name;
    switch (type) {
      case 'GlobalAssign': {
        const name = node.getChild('Identifier').text;
        this.globals[name] = this.eval(node.getChild('Expr'));
        break;
      }
      case 'LocalAssign': {
        const name = node.getChild('Identifier').text;
        this.locals[name] = this.eval(node.getChild('Expr'));
        break;
      }
      case 'FuncDef': {
        const name = node.getChild('Identifier').text;
        this.functions[name] = node;
        break;
      }
      case 'ForLoop': {
        const id = node.getChild('Identifier').text;
        const arr = this.eval(node.getChild('Expr'));
        for (let item of arr || []) {
          this.locals[id] = item;
          this.execStatements(node.getChild('Block').children);
        }
        break;
      }
      case 'WhileLoop': {
        while (this.eval(node.getChild('Expr'))) {
          this.execStatements(node.getChild('Block').children);
          if (this.returnValue !== undefined) break;
        }
        break;
      }
      case 'IfStmt': {
        const cond = this.eval(node.getChild('Expr'));
        if (cond) this.execStatements(node.getChild('Block').children);
        else {
          const elseBlock = node.children.find(n => n.name === 'Block' && n !== node.getChild('Block'));
          if (elseBlock) this.execStatements(elseBlock.children);
        }
        break;
      }
      case 'ReturnStmt': {
        this.returnValue = this.eval(node.getChild('Expr'));
        break;
      }
      case 'SelectStmt': {
        const list = node.getChild('ExprList').children.filter(c => c.name === 'Expr').map(expr => expr);
        const tableName = node.getChild('Identifier').text;
        const arr = this.globals[tableName] || [];
        const results = [];
        for (let rec of arr) {
          const row = {};
          list.forEach((exprNode, i) => {
            // Простой: если это Identifier, берём поле из rec
            const child = exprNode.firstChild;
            if (child.name === 'Identifier') {
              const key = child.text;
              row[key] = rec[key];
            }
          });
          results.push(row);
        }
        this.returnValue = results;
        break;
      }
      case 'ExprStmt': {
        this.eval(node.getChild('Expr'));
        break;
      }
    }
  }

  eval(node) {
    switch (node.name) {
      case 'Number':
        return parseFloat(node.text);
      case 'String':
        return node.text.slice(1, -1);
      case 'Identifier':
        return this.locals[node.text] !== undefined
          ? this.locals[node.text]
          : this.globals[node.text];
      case 'Expr': {
        const ch = node.children;
        if (ch.length === 3 && ch[1].name === 'Expr') {
          // recursed?
        }
        if (ch.length === 3 && ch[1].text) {
          const left = this.eval(ch[0]);
          const op = ch[1].text;
          const right = this.eval(ch[2]);
          switch (op) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '&&': return left && right;
            case '||': return left || right;
          }
        }
        // Функция
        if (ch.length >= 2 && ch[0].name === 'Identifier' && ch[1].name === 'ArgList') {
          const fn = ch[0].text;
          const args = ch[1].children.filter(c => c.name === 'Expr').map(expr => this.eval(expr));
          return this.callFunction(fn, args);
        }
        // Массив
        if (node.firstChild.name === '[') {
          return node.children
            .filter(c => c.name === 'Expr')
            .map(expr => this.eval(expr));
        }
        // Объект
        if (node.firstChild.name === '{') {
          const obj = {};
          node.getChild('PairList')?.children
            .filter(c => c.name === 'Pair')
            .forEach(pair => {
              const key = pair.getChild('Identifier').text;
              const val = this.eval(pair.getChild('Expr'));
              obj[key] = val;
            });
          return obj;
        }
        // группы
        if (node.firstChild.name === '(') {
          return this.eval(node.getChild('Expr'));
        }
        break;
      }
    }
    return undefined;
  }

  callFunction(name, args) {
    switch(name) {
      case 'toInt': return parseInt(args[0]);
      case 'toString': return args[0]?.toString();
      default:
        if (this.functions[name]) {
          const fn = this.functions[name];
          const params = fn.getChild('ParamList')?.children.filter(c => c.name === 'Identifier').map(c => c.text) || [];
          const oldLocals = { ...this.locals };
          this.locals = {};
          params.forEach((p,i) => this.locals[p] = args[i]);
          this.execStatements(fn.getChild('Block').children);
          const ret = this.returnValue;
          this.returnValue = undefined;
          this.locals = oldLocals;
          return ret;
        }
    }
    throw new Error(`Unknown function: ${name}`);
  }
}