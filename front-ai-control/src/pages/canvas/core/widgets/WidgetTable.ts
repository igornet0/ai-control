import { WidgetBase } from '../WidgetBase';

export class WidgetTable extends WidgetBase {
  private columns: string[];
  private data: string[][];
  private sortIndex: number | null = null;
  private sortAsc: boolean = true;

  constructor(props: any) {
    super(props);
    this.columns = props.columns ?? ['Name', 'Value'];
    this.data = props.data ?? [
      ['Item 1', '10'],
      ['Item 2', '20'],
      ['Item 3', '30'],
    ];
  }

  handleClick(mx: number, my: number) {
    const rowHeight = 30;
    const colWidth = this.width / this.columns.length;

    // Проверка: клик по заголовку
    if (my >= this.y && my <= this.y + rowHeight) {
        const colIndex = Math.floor((mx - this.x) / colWidth);

        if (colIndex >= 0 && colIndex < this.columns.length) {
        if (this.sortIndex === colIndex) {
            this.sortAsc = !this.sortAsc;
        } else {
            this.sortIndex = colIndex;
            this.sortAsc = true;
        }

        this.data.sort((a, b) => {
            const valA = a[colIndex];
            const valB = b[colIndex];
            return this.sortAsc
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        });
        }
    }
    }

  draw(ctx: CanvasRenderingContext2D): void {
    const rowHeight = 30;
    const colWidth = this.width / this.columns.length;

    // Фон таблицы
    ctx.fillStyle = '#222';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Заголовок
    this.columns.forEach((col, i) => {
      const cellX = this.x + i * colWidth;
      const cellY = this.y;

      ctx.fillStyle = '#444';
      ctx.fillRect(cellX, cellY, colWidth, rowHeight);

      ctx.fillStyle = '#fff';
    //   ctx.fillText(col, cellX + 10, cellY + rowHeight / 2);
      ctx.fillText(
        col + (this.sortIndex === i ? (this.sortAsc ? ' ▲' : ' ▼') : ''),
        cellX + 10,
        cellY + rowHeight / 2
        );
    });

    // Строки
    this.data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellX = this.x + colIndex * colWidth;
        const cellY = this.y + (rowIndex + 1) * rowHeight;

        ctx.fillStyle = rowIndex % 2 === 0 ? '#333' : '#2a2a2a';
        ctx.fillRect(cellX, cellY, colWidth, rowHeight);

        ctx.fillStyle = '#eee';
        ctx.fillText(cell, cellX + 10, cellY + rowHeight / 2);
      });
    });

    // Рамка таблицы
    ctx.strokeStyle = '#666';
    ctx.strokeRect(this.x, this.y, this.width, this.height);
  }
}