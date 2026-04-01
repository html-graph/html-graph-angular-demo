import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  input,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Identifier } from '@html-graph/html-graph';

@Component({
  templateUrl: './graph-node.html',
  styleUrl: './graph-node.less',
})
export class GraphNode implements AfterViewInit {
  @ViewChild('portIn', { static: true })
  portIn!: ElementRef;

  @ViewChild('portOut', { static: true })
  portOut!: ElementRef;

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
