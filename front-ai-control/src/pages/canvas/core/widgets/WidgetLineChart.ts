import { WidgetBase } from '../WidgetBase';

export class WidgetLineChart extends WidgetBase {
  private data: number[];
  private labels: string[];

  constructor(props: any) {
    super(props);
    this.data = props.data ?? [10, 30, 20, 50];
    this.labels = props.labels ?? ['Q1', 'Q2', 'Q3', 'Q4'];
  }

  draw(ctx: CanvasRenderingContext2D) {
    const padding = 40;
    const maxVal = Math.max(...this.data);
    const colors = ['#4e79a7'];

    const stepX = (this.width - padding * 2) / (this.data.length - 1);
    const stepY = (this.height - padding * 2) / maxVal;

    const zeroX = this.x + padding;
    const zeroY = this.y + this.height - padding;

    // Рисуем оси
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(zeroX, this.y + padding);         // Ось Y
    ctx.lineTo(zeroX, zeroY);
    ctx.lineTo(this.x + this.width - padding, zeroY); // Ось X
    ctx.stroke();

    // Отрисовка линии
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    ctx.beginPath();

    this.data.forEach((val, i) => {
        const x = zeroX + i * stepX;
        const y = zeroY - val * stepY;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Точки и подписи
    this.data.forEach((val, i) => {
        const x = zeroX + i * stepX;
        const y = zeroY - val * stepY;

        // Точка
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Значение
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${val}k`, x, y - 10);

        // Подпись X
        ctx.fillStyle = '#ccc';
        ctx.save();
        ctx.translate(x, zeroY + 10);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(this.labels[i], 0, 10);
        ctx.restore();
    });

    // Деления по Y (каждые 25%)
    ctx.strokeStyle = '#333';
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
        const yVal = (maxVal / 4) * i;
        const y = zeroY - stepY * yVal;
        ctx.beginPath();
        ctx.moveTo(zeroX - 5, y);
        ctx.lineTo(zeroX, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(yVal)}k`, zeroX - 8, y + 3);
    }

    // Рамка
    ctx.strokeStyle = '#444';
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}