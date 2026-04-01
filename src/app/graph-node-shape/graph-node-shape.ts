import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  input,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Identifier } from '@html-graph/html-graph';
import { nodeDimensions } from '../node-dimensions';

@Component({
  templateUrl: './graph-node-shape.html',
  styleUrl: './graph-node-shape.less',
})
export class GraphNodeShape implements AfterViewInit {
  @ViewChild('portIn', { static: true })
  portIn!: ElementRef;

  @ViewChild('portOut', { static: true })
  portOut!: ElementRef;

  @HostBinding('style.width.px')
  protected readonly minWidth = nodeDimensions.width;

  @HostBinding('style.height.px')
  protected readonly minHeigh = nodeDimensions.height;

  readonly expanded = input.required<boolean>();

  @Input({ required: true })
  nodeId!: Identifier;

  @Input({ required: true })
  name!: string;

  @Input({ required: true })
  hasChildren!: string;

  @Output()
  readonly afterInitialized = new EventEmitter();

  @Output()
  readonly expandTriggered = new EventEmitter();

  @Output()
  readonly collapseTriggered = new EventEmitter();

  ngAfterViewInit(): void {
    this.afterInitialized.emit();
  }

  protected expand(): void {
    this.expandTriggered.emit();
  }

  protected collapse(): void {
    this.collapseTriggered.emit();
  }
}
