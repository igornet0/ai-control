import { WidgetBase } from '../WidgetBase';

export class WidgetPieChart extends WidgetBase {
  private data: number[];
  private labels: string[];

  constructor(props: any) {
    super(props);
    this.data = props.data ?? [30, 70, 100];
    this.labels = props.labels ?? ['Red', 'Green', 'Blue'];
  }

  draw(ctx: CanvasRenderingContext2D) {
    const radius = Math.min(this.width, this.height) / 3;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2 - 10;
    const total = this.data.reduce((a, b) => a + b, 0);
    const colors = ['#e15759', '#59a14f', '#4e79a7', '#f28e2b', '#b07aa1'];

    let startAngle = 0;

    this.data.forEach((value, i) => {
      const angle = (value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.fillStyle = colors[i % colors.length];
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
      ctx.fill();
      startAngle += angle;
    });

    // Легенда снизу
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';

    const legendStartX = this.x + 10;
    const legendStartY = this.y + this.height - 40;
    let legendX = legendStartX;
    let legendY = legendStartY;

    this.labels.forEach((label, i) => {
      const labelText = label;
      const labelWidth = ctx.measureText(labelText).width + 30;

      if (legendX + labelWidth > this.x + this.width - 10) {
        legendX = legendStartX;
        legendY += 16;
      }

      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(legendX, legendY, 10, 10);

      ctx.fillStyle = '#ccc';
      ctx.fillText(labelText, legendX + 14, legendY + 9);

      legendX += labelWidth + 10;
    });

    // рамка
    ctx.strokeStyle = '#444';
    ctx.strokeRect(this.x, this.y, this.width, this.height);
  }
}