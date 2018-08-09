import {Card} from '../models/card';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {MyEventsService, MysteriousCardObject} from './my-events.service';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';
import 'rxjs/add/observable/from';
import 'rxjs/add/observable/interval';
import 'rxjs/add/operator/delay';
import {select} from '@angular-redux/store';
import {User} from '../models/user';
import {Member} from '../models/member';
import {Select, Store} from '@ngxs/store';
import {AddInbox, AddOutbox, ClearInbox, ClearOutbox, HideHelp, UpdateLastUpdate} from './ngxs/app.action';
import {InboxState} from './ngxs/inbox.state';
import {OutboxState} from './ngxs/outbox.state';
import {MyEventsState} from './ngxs/my-events.state';
import {take} from 'rxjs/operators';

export enum Phase {
  Done,
  Prepare,
  Fetch,
}

@Component({
  selector: 'app-my-events',
  templateUrl: './my-events.component.html',
  styleUrls: ['./my-events.component.scss']
})

export class MyEventsComponent implements OnInit, OnDestroy {

  @select('user') public user$: Observable<User>;
  @select('members') public members$: Observable<{ [id: string]: Member }>;
  @select('cards') public cards$: Observable<Card[]>;


  currentPhase: Phase = Phase.Done;
  phaseEnum = Phase;

  @Select(InboxState.getInbox) inbox$: Observable<Card[]>;
  @Select(OutboxState.getOutbox) outbox$: Observable<Card[]>;
  @Select(MyEventsState.getLastUpdate) lastUpdate$: Observable<Date | undefined>;
  @Select(MyEventsState.getHideHelp) hideHelp$: Observable<boolean>;

  loadingInfo = {
    members: 0,
    cards: 0,
    loadedMembers: 0,
    loadedCards: 0,
  };

  constructor(private myEventsService: MyEventsService, private store: Store) {
  }

  ngOnInit() {
  }

  async fetchingProcedure() {


    /******************************************************
     * 1. Reset:
     ******************************************************/
    this.loadingInfo = {
      members: 0,
      cards: 0,
      loadedMembers: 0,
      loadedCards: 0,
    };


    this.currentPhase = Phase.Prepare;

    this.store.dispatch([
      new ClearOutbox(),
    ]);

    this.store.dispatch([
      new ClearInbox(),
    ]);


    /******************************************************
     * 2. Load some required data from store
     ******************************************************/

    const allCards = await this.cards$
      .pipe(take(1))
      .toPromise();


    const membersMap = await this.members$
      .pipe(take(1))
      .toPromise();

    const user = await this.user$
      .pipe(take(1))
      .toPromise();


    const membersArr: Member[] = Object
      .keys(membersMap)
      .map(it => membersMap[it]);

    const otherMemberNames = membersArr
      .filter(it => it.username !== user.username)
      .map(it => it.username);


    /******************************************************
     * 3. Fetch Cards per User:
     ******************************************************/

    this.loadingInfo.members = membersArr.length;

    const memberRequestArr = membersArr
      .map(async member => {
        const cards = await this.myEventsService.getCardsByUser(member.username);
        this.loadingInfo.loadedMembers++;
        return cards;
      });

    const responses: Card[][] = await Promise.all(memberRequestArr);

    const cardMap = new Map<string, Card>();
    // Put all Cards in a Map in order to remove duplicates
    responses
      .reduce((previousValue, currentValue) => [...previousValue, ...currentValue], [])
      .map(card => cardMap.set(card.id, card));


    /******************************************************
     * 4. Fetch the Comments per Card:
     ******************************************************/

    this.currentPhase = Phase.Fetch;
    this.loadingInfo.cards = cardMap.size;

    const allRequests = Array.from(cardMap.values())
      .map(async card => {
        // what if one is
        const data = await this.myEventsService.getCommentCards(card.id).toPromise();
        this.loadingInfo.loadedCards++;
        try {
          this.checkInAndOutBox(data as any, user.id, user.username, otherMemberNames, allCards);
        } catch (e) {
          console.error(e);
        }
      });

    // be Done in any case - even if requests fail.
    Promise.all(allRequests).finally(() => {
      this.currentPhase = Phase.Done;
      this.store.dispatch(new UpdateLastUpdate());
    });
  }


  checkInAndOutBox(commentCards: MysteriousCardObject[], myUserId: string, myUsername: string, otherMemberNames: string[], allCards: Card[]) {

    const firstCommentCard = commentCards[0];
    const firstComment: string = firstCommentCard.data.text;
    const cardWithFewInfo: { id: string } = firstCommentCard.data.card;

    if (firstComment.includes('@' + myUsername)) {
      const fullCard = allCards.find(it => it.id === cardWithFewInfo.id);
      this.store.dispatch(new AddInbox(fullCard));
    }


    for (const name of otherMemberNames) {
      if (firstComment.includes('@' + name) && firstCommentCard.idMemberCreator === myUserId) {
        const fullCard = allCards.find(it => it.id === cardWithFewInfo.id);
        this.store.dispatch(new AddOutbox(fullCard));
      }
    }
  }


  hide() {
    this.store.dispatch(new HideHelp());
  }

  ngOnDestroy(): void {
  }

}
