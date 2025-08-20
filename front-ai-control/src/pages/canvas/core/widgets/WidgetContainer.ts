import { WidgetBase } from '../WidgetBase';

export class WidgetContainer extends WidgetBase {
  private children: WidgetBase[] = [];
  private currentIndex: number = 0;

  addWidget(widget: WidgetBase) {
    // Настроим размер дочернего виджета под контейнер
    widget.x = 0;
    widget.y = 0;
    widget.width = this.width;
    widget.height = this.height - 40; // учтём панель навигации

    this.children.push(widget);
  }

  next() {
    if (this.currentIndex < this.children.length - 1) {
      this.currentIndex++;
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.clip();

    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Кнопка ВЛЕВО
    if (this.currentIndex > 0) {
      ctx.fillStyle = '#555';
      ctx.fillRect(this.x + 10, this.y + 10, 30, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('<', this.x + 18, this.y + 20);
    }

    // Кнопка ВПРАВО
    if (this.currentIndex < this.children.length - 1) {
      ctx.fillStyle = '#555';
      ctx.fillRect(this.x + this.width - 40, this.y + 10, 30, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('>', this.x + this.width - 28, this.y + 20);
    }

    // Рисуем текущего ребёнка по центру
    const child = this.children[this.currentIndex];
    if (child) {
      ctx.save();
      ctx.translate(this.x, this.y + 40); // Оставим место для кнопок
      child.width = this.width;
      child.height = this.height - 40;
      child.draw(ctx);
      ctx.restore();
    }

    ctx.strokeStyle = '#888';
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    ctx.restore();
  }

  isHit(mx: number, my: number): boolean {
    return (
      mx >= this.x &&
      mx <= this.x + this.width &&
      my >= this.y &&
      my <= this.y + this.height
    );
  }

  addIfHit(widget: WidgetBase, mx: number, my: number): boolean {
    if (this.isHit(mx, my)) {
      this.addWidget(widget);
      return true;
    }
    return false;
  }

  handleClick(mx: number, my: number) {
    // Влево
    if (
      this.currentIndex > 0 &&
      mx >= this.x + 10 &&
      mx <= this.x + 40 &&
      my >= this.y + 10 &&
      my <= this.y + 30
    ) {
      this.prev();
      return;
    }

    // Вправо
    if (
      this.currentIndex < this.children.length - 1 &&
      mx >= this.x + this.width - 40 &&
      mx <= this.x + this.width - 10 &&
      my >= this.y + 10 &&
      my <= this.y + 30
    ) {
      this.next();
      return;
    }

    // 👇 Делегируем клик текущему активному дочернему виджету
    const child = this.getCurrentWidget();
    if (child) {
      const localX = mx - this.x;
      const localY = my - this.y - 40; // смещение на панель управления
      if (typeof (child as any).handleClick === 'function') {
        (child as any).handleClick(localX, localY);
      }
    }
  }

  getChildren() {
    return this.children;
  }

  getCurrentWidget() {
    return this.children[this.currentIndex];
  }
}