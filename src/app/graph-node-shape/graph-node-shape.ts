import { Component, ElementRef, HostBinding, input, output, ViewChild } from '@angular/core';
import { Identifier } from '@html-graph/html-graph';
import { nodeDimensions } from '../node-dimensions';

@Component({
  templateUrl: './graph-node-shape.html',
  styleUrl: './graph-node-shape.less',
})
export class GraphNodeShape {
  @ViewChild('portIn', { static: true })
  portIn!: ElementRef;

  @ViewChild('portOut', { static: true })
  portOut!: ElementRef;

  @HostBinding('style.width.px')
  protected readonly minWidth = nodeDimensions.width;

  @HostBinding('style.height.px')
  protected readonly minHeigh = nodeDimensions.height;

  readonly expanded = input.required<boolean>();

  nodeId = input.required<Identifier>();

  name = input.required<string>();

  hasChildren = input.required<boolean>();

  readonly expandTriggered = output();

  readonly collapseTriggered = output();

  protected expand(): void {
    this.expandTriggered.emit();
  }

  protected collapse(): void {
    this.collapseTriggered.emit();
  }
}
