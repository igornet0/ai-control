import { WidgetBase } from '../WidgetBase';

interface FilterOption {
  column: string;
  operator: string;
  value: string | number;
}

export class WidgetFilter extends WidgetBase {
  private options: FilterOption[];

  constructor(props: any) {
    super(props);
    this.options = props.options || [];
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width, height } = this;
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📊 Filter', x + 10, y + 20);

    this.options.forEach((opt, i) => {
      const text = `${opt.column} ${opt.operator} ${opt.value}`;
      ctx.fillText(text, x + 10, y + 40 + i * 20);
    });

    ctx.strokeStyle = '#444';
    ctx.strokeRect(x, y, width, height);
  }

  applyFilter(data: any[]): any[] {
    return data.filter(row =>
      this.options.every(opt => {
        const cell = row[opt.column];
        switch (opt.operator) {
          case '=': return cell === opt.value;
          case '!=': return cell !== opt.value;
          case '>': return cell > opt.value;
          case '<': return cell < opt.value;
          case 'contains': return String(cell).includes(String(opt.value));
          default: return true;
        }
      })
    );
  }

  setOption(opt: FilterOption) {
    this.options = [...this.options.filter(o => o.column !== opt.column), opt];
  }

  getOptions() {
    return this.options;
  }
}