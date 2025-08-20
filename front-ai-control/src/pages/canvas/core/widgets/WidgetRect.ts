import { WidgetBase } from '../WidgetBase';

export class WidgetRect extends WidgetBase {
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#32e87f';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.fillStyle = '#000';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Rect ${this.id}`, this.x + 20, this.y + 20);
  }
}