import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AppStore } from './app-store';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.less',
  providers: [AppStore],
})
export class App implements OnInit, OnDestroy {
  private readonly store = inject(AppStore);

  @ViewChild('canvas', { static: true })
  readonly canvas!: ElementRef;

  ngOnInit(): void {
    this.store.init(this.canvas.nativeElement);
  }

  ngOnDestroy(): void {
    this.store.destroy();
  }
}
