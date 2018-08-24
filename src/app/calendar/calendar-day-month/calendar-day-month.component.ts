import {Component, ElementRef, HostListener, Input, OnDestroy, OnInit, Renderer} from '@angular/core';
import {CalendarDay} from '../../models/calendar-day';
import {select} from '@angular-redux/store';
import {Observable, Subscription} from 'rxjs';
import {Card} from '../../models/card';
import {CardActions} from '../../redux/actions/card-actions';
import {ContextMenuService} from '../context-menu-holder/context-menu.service';
import {selectCalendarCards} from '../../redux/store/selects';
import {DropZoneService} from '../../services/drop-zone.service';
import {DragDropData} from '@beyerleinf/ngx-dnd';
import {compareAsc, getHours, getMinutes, getSeconds, isSameDay, setHours, setMinutes, setSeconds} from 'date-fns';

@Component({
  selector: 'app-calendar-day-month',
  templateUrl: './calendar-day-month.component.html',
  styleUrls: ['./calendar-day-month.component.scss'],
})
export class CalendarDayForMonthComponent implements OnInit, OnDestroy {

  @select(selectCalendarCards) public cards$: Observable<Card[]>;
  @Input() public calendarDay: CalendarDay;
  public cards: Card[];
  private subscriptions: Subscription[] = [];

  constructor(public cardActions: CardActions,
              private renderer: Renderer,
              private element: ElementRef,
              private contextMenuService: ContextMenuService, private dropZoneService: DropZoneService) {
  }


  @HostListener('contextmenu', ['$event'])
  onOpenContext(event: MouseEvent) {
    if (!this.contextMenuService.registration) { // disabled for now, remove to activte !
      event.preventDefault();
      const left = event.pageX;
      const top = event.pageY;
      this.contextMenuService.registration.move(left, top);
    }
  }

  ngOnInit() {
    this.subscriptions.push(
      this.cards$.subscribe(
        cards => {
          this.cards = cards
            .filter(card => {
              // Hello
              //
              // I'm a performance bottlneck.
              //
              // remove me if you have time.
              //
              // I have already been mitigated with selectVisibleCardsInRange
              // - but with many cards I still cause far too many iterations.
              return isSameDay(card.due, this.calendarDay.date);
            })
            .sort((a, b) => compareAsc(a.due, b.due));
        }
      ));
  }


  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onDropSuccess(event: DragDropData) {
    const card: Card = event.dragData;

    let hours = 12, minutes = 0, seconds = 0;

    if (card.due) {
      hours = getHours(card.due);
      minutes = getMinutes(card.due);
      seconds = getSeconds(card.due);
    }

    const due = setSeconds(setMinutes(setHours(this.calendarDay.date, hours), minutes), seconds);
    this.cardActions.updateCardsDue(card.id, due);
  }

  dragStart($event: DragDropData) {
    this.dropZoneService.dragStart();
  }

  dragEnd($event: DragDropData) {
    this.dropZoneService.dragStop();
  }
}

