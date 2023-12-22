import { AnimationBuilder, AnimationMetadata, animate, style } from '@angular/animations';
import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, HostListener, Inject, OnInit, Renderer2 } from '@angular/core';

const constants = {
  direction: {
    UP: 'up',
    DOWN: 'down'
  },
  class: {
    DRAG_PLACEHOLDER: 'drag-placeholder',
    LIST_DRAG: 'list-drag',
    DRAGGING: 'dragging',
    HOST_DRAG: 'host-drag',
  },
  attribute: {
    LIST_DRAG: 'listDrag',
  }
}

@Directive({
  selector: '[listDraggable]'
})
export class ListDraggableDirective implements OnInit {

  private mouseDown = false;

  private dragItem?: HTMLElement;

  private dragPlaceholder?: HTMLElement;

  private initialX = 0;

  private initialY = 0;

  private xOffset = 0;

  private yOffset = 0;

  private previousTarget: any = null;

  private elementSize = 0;


  @HostListener('document:mouseup')
  onMouseUp() {
    if(this.mouseDown) {
      this.mouseDown = false;
    }

    if(!this.dragItem) {
      return;
    }

    const index = this.getDragPlaceholderIndex();
    const node = this.list[index];
    if(node) {
      const animation = this.animate(
        animate('200ms', style({
          top: node.offsetTop,
          left: node.offsetLeft,
        })),
        this.dragItem
      );

      animation.onDone(() => {
        animation.destroy();

        this.renderer.removeAttribute(this.dragPlaceholder, 'style');
        this.renderer.removeAttribute(this.dragPlaceholder, 'class');
        this.dragPlaceholder?.remove();

        const refChild = this.list[index];

        this.renderer.removeAttribute(this.dragItem, 'style');
        this.renderer.removeAttribute(this.dragItem, 'class');
        this.renderer.insertBefore(this.host.nativeElement, this.dragItem, refChild, true);

        this.list.forEach(item => {
          this.renderer.removeAttribute(item, 'style');
          this.renderer.removeAttribute(item, 'class');
        });

        this.renderer.removeAttribute(this.host.nativeElement, 'style');
        this.renderer.removeClass(this.host.nativeElement, constants.class.HOST_DRAG);

      });
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMove(ev: MouseEvent) {
    if(!this.mouseDown) {
      return;
    }

    if(!this.dragItem) {
      return;
    }
    const { direction: { UP, DOWN } } = constants;
    const newY = ev.clientY - this.yOffset - window.scrollY;
    const newX = ev.clientX - this.xOffset - window.scrollX;

    this.dragItem.style.top = newY + 'px';
    this.dragItem.style.left = newX + 'px';

    const newTarget = this.document.elementsFromPoint(ev.clientX, ev.clientY).find(el => el.hasAttribute(constants.attribute.LIST_DRAG) && !el.classList.contains(constants.class.DRAGGING));
    if(newTarget !== this.previousTarget) {
      this.previousTarget = newTarget;
      if(newTarget) {
        const placeholderIndex = this.getDragPlaceholderIndex();
        const targetIndex = this.getIndex(<HTMLElement>newTarget);
        const direction = placeholderIndex > targetIndex ? UP : DOWN;
        this.dragOperation(targetIndex, placeholderIndex, direction);
      }
    }
  }

  constructor(
    @Inject(DOCUMENT)
    private readonly document: Document,
    private readonly host: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly builder: AnimationBuilder
  ) { }

  dragOperation(targetIndex: number, placeholderIndex: number, direction: string) {
    const { direction: { UP }, class: {DRAG_PLACEHOLDER} } = constants;
    const filtered = this.list.filter(item => {
      const isDragPlaceholder = item.classList.contains(DRAG_PLACEHOLDER);

      const currentIndex = isDragPlaceholder ? this.getDragPlaceholderIndex() : this.getIndex(item);

      if(direction === UP) {
        return currentIndex >= targetIndex && currentIndex <= placeholderIndex && !isDragPlaceholder;
      } else {
        return currentIndex >= placeholderIndex && currentIndex <= targetIndex && !isDragPlaceholder ;
      }
    });
    filtered.forEach(item => {
      this.updateElementPosition(item, direction);
      this.updateDragPlaceholderPosition(direction);
    });
  }

  ngOnInit(): void {
    this.init();
  }

  get list(): HTMLElement[] {
    return Array.from(this.host.nativeElement.children) as HTMLElement[];
  }

  private init(): void {
    const { class: { DRAG_PLACEHOLDER, LIST_DRAG, DRAGGING, HOST_DRAG } } = constants;

    const parent = this.host.nativeElement!;

    parent.addEventListener('mousedown', (ev) => {
      const target = this.document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;

      if(target.classList.contains('list') && target.children.length === 0) {
        return;
      }

      this.initialX = target.offsetLeft;
      this.initialY = target.offsetTop;

      this.elementSize = target.getBoundingClientRect().height;

      this.mouseDown = true;

      this.dragItem = target;

      if(this.dragItem) {
        parent.style.userSelect = 'none';
        this.dragItem.style.userSelect = 'none';

        const dragItemRect = this.dragItem.getBoundingClientRect();
        const startWidth = dragItemRect.width;
        const startHeight = dragItemRect.height;

        this.dragPlaceholder = this.document.createElement('div');
        this.dragPlaceholder.style.width = startWidth + 'px';
        this.dragPlaceholder.style.height = startHeight + 'px';
        this.dragPlaceholder.classList.add(DRAG_PLACEHOLDER);

        parent.insertBefore(this.dragPlaceholder, this.dragItem);
        parent.removeChild(this.dragItem);

        this.dragItem.classList.remove(LIST_DRAG);
        this.dragItem.classList.add(DRAGGING);

        this.dragItem.style.position = 'absolute';
        this.dragItem.style.left = this.initialX + 'px';
        this.dragItem.style.top = this.initialY + 'px';
        this.dragItem.style.width = startWidth + 'px';
        this.dragItem.style.height = startHeight + 'px';

        this.xOffset = ev.clientX - this.initialX - window.scrollX;
        this.yOffset = ev.clientY - this.initialY - window.scrollY;

        this.renderer.appendChild(this.document.body, this.dragItem);

        this.host.nativeElement.classList.add(HOST_DRAG);

        this.list.forEach(item => item.classList.add(LIST_DRAG));

      }
    });

  }

  private getIndex(element: HTMLElement): number {
    const currentY = this.getTransform(element);

    let idx = this.list.indexOf(element);

    if(currentY === -this.elementSize) {
      idx--;
    }

    if(currentY === this.elementSize) {
      idx++;
    }

    return idx;
  }

  private getDragPlaceholderIndex(): number {
    const dragPlaceholderCurrentY = this.getTransform(this.dragPlaceholder!);

    let idx = this.list.indexOf(this.dragPlaceholder!);

    if(dragPlaceholderCurrentY <= -this.elementSize) {
      const translateStep = Math.abs(dragPlaceholderCurrentY) / this.elementSize;
      idx = idx - translateStep;
    }

    if(dragPlaceholderCurrentY >= this.elementSize) {
      idx = idx + dragPlaceholderCurrentY / this.elementSize;
    }

    return idx;
  }

  private updateElementPosition(element: HTMLElement, direction: string) {
    const currentY = this.getTransform(element);
    const { direction: { DOWN } } = constants;

    if(currentY === this.elementSize || currentY === -this.elementSize) {
      element.style.transform = `translateY(0px)`;
    }

    if(currentY === 0) {
      element.style.transform = `translateY(${
        direction === DOWN ? -this.elementSize : this.elementSize
      }px)`;
    }
  }

  private updateDragPlaceholderPosition(direction: string) {
    const currentY = this.getTransform(this.dragPlaceholder!);
    const { direction: { DOWN } } = constants;
    if(Math.abs(currentY) > 0) {
      this.dragPlaceholder!.style.transform = `translate(${
        direction === DOWN ? currentY + this.elementSize : currentY - this.elementSize
      }px)`;
    } else {
      this.dragPlaceholder!.style.transform = `translate(${
        direction === DOWN ? this.elementSize : -this.elementSize
      }px)`;
    }
  }

  private animate(animationMetadata: AnimationMetadata | AnimationMetadata[], element: HTMLElement) {
    const animation = this.builder.build(animationMetadata);
    const player = animation.create(element);
    player.play();

    return player;
  }

  private getTransform(element: HTMLElement): number {
    return Number(element.style.getPropertyValue('transform').replace(/[^0-9\-]/g, ''));
  }
}
