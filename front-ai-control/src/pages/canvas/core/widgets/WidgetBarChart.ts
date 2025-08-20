import { WidgetBase } from '../WidgetBase';

export class WidgetBarChart extends WidgetBase {
  private data: number[];
  private labels: string[];
  

  constructor(props: any) {
    super(props);
    this.data = props.data ?? [10, 20, 30];
    this.labels = props.labels ?? ['A', 'B', 'C'];
  }

  draw(ctx: CanvasRenderingContext2D) {
    const padding = 30;
    const barGap = 10;
    const legendHeight = 50;
    const barAreaHeight = this.height - legendHeight;
    const barWidth = (this.width - padding * 2 - (this.data.length - 1) * barGap) / this.data.length;
    const maxVal = Math.max(...this.data);
    const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7'];

    // Отрисовка баров
    this.data.forEach((val, i) => {
        const barHeight = (val / maxVal) * (barAreaHeight - padding);
        const x = this.x + padding + i * (barWidth + barGap);
        const y = this.y + barAreaHeight - barHeight;

        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y, barWidth, barHeight);

        // Значение сверху
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`$${val.toFixed(2)}`, x + barWidth / 2, y - 5);

        // Подпись снизу
        ctx.fillStyle = '#ddd';
        ctx.font = '11px sans-serif';
        ctx.fillText(this.labels[i], x + barWidth / 2, this.y + barAreaHeight + 15);
    });

    // Легенда
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';

    const legendStartX = this.x + 10;
    const legendStartY = this.y + this.height - legendHeight + 20;
    let legendX = legendStartX;
    let legendY = legendStartY;

    const legendSpacing = 10;

    this.labels.forEach((label, i) => {
        const color = colors[i % colors.length];
        const labelText = label;
        const labelWidth = ctx.measureText(labelText).width + 30; 
        
        if (legendX + labelWidth > this.x + this.width - 10) {
            legendX = legendStartX;
            legendY += 16; 
        }

        ctx.fillStyle = color;
        ctx.fillRect(legendX, legendY, 10, 10);

        ctx.fillStyle = '#ccc';
        ctx.fillText(labelText, legendX + 14, legendY + 9);

        legendX += labelWidth + legendSpacing;
    });

    ctx.restore();

    // Рамка
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}