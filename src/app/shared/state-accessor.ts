import { BehaviorSubject } from 'rxjs';
import {
  DefaultContext,
  EventObject,
  Interpreter,
  State,
  StateSchema
} from 'xstate';

/**
 * Utility class to access _XState_ current state
 *
 * @deprecated
 *
 * Use the native _XState_ service instead: {@link https://xstate.js.org/docs/recipes/rxjs.html}
 */
export class StateAccessor<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject
> {
  /**
   * Observable for the current state
   */
  public readonly current$: BehaviorSubject<State<TContext, TEvent>>;

  constructor(interpreter: Interpreter<TContext, TStateSchema, TEvent>) {
    this.current$ = new BehaviorSubject(interpreter.state);
    interpreter.onTransition(state => {
      this.current$.next(state);
    });
  }
}
