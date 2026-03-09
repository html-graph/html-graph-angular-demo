import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CanvasAdapter } from './canvas-adapter';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.less',
  providers: [CanvasAdapter],
})
export class App implements OnInit, OnDestroy {
  private readonly adapter = inject(CanvasAdapter);

  @ViewChild('canvas', { static: true })
  readonly canvas!: ElementRef;

  ngOnInit(): void {
    this.adapter.init(this.canvas.nativeElement);
  }

  ngOnDestroy(): void {
    this.adapter.destroy();
  }
}
