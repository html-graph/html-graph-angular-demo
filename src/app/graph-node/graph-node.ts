import { Component, ElementRef, inject, Input, ViewChild } from '@angular/core';
import { AppStore } from '../app-store';

@Component({
  selector: 'app-graph-node',
  templateUrl: './graph-node.html',
  styleUrl: './graph-node.less',
})
export class GraphNode {
  @ViewChild('portIn', { static: true })
  portIn!: ElementRef;

  @ViewChild('portOut', { static: true })
  portOut!: ElementRef;

  private readonly store = inject(AppStore);

  @Input({ required: true })
  id!: number;

  @Input({ required: true })
  name!: string;

  protected onClick(): void {
    this.store.addChildren(this.id);
  }
}
