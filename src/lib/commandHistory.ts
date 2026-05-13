import { CanvasElement } from '../types';

export interface CommandContext {
  getElements: () => CanvasElement[];
  setElements: (elements: CanvasElement[]) => void;
}

export interface ICommand<TContext> {
  id: string;
  type: string;
  timestamp: number;
  description: string;
  execute: (context: TContext) => void;
  undo: (context: TContext) => void;
  canMergeWith?: (other: ICommand<TContext>) => boolean;
  merge?: (other: ICommand<TContext>) => ICommand<TContext>;
}

const createCommandId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const areElementListsEqual = (left: CanvasElement[], right: CanvasElement[]) =>
  JSON.stringify(left) === JSON.stringify(right);

export class CanvasElementsCommand implements ICommand<CommandContext> {
  id = createCommandId();
  type = 'CanvasElements';
  timestamp = Date.now();

  constructor(
    public description: string,
    private before: CanvasElement[],
    private after: CanvasElement[],
    private mergeKey?: string
  ) {}

  execute(context: CommandContext) {
    context.setElements(this.after);
  }

  undo(context: CommandContext) {
    context.setElements(this.before);
  }

  canMergeWith(other: ICommand<CommandContext>) {
    return other instanceof CanvasElementsCommand && Boolean(this.mergeKey) && this.mergeKey === other.mergeKey;
  }

  merge(other: ICommand<CommandContext>) {
    if (!(other instanceof CanvasElementsCommand)) return this;
    return new CanvasElementsCommand(this.description, this.before, other.after, this.mergeKey);
  }
}

export class CommandHistory<TContext> {
  private undoStack: ICommand<TContext>[] = [];
  private redoStack: ICommand<TContext>[] = [];

  constructor(
    private config = {
      maxSize: 100,
      mergeWindow: 500,
    }
  ) {}

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  execute(command: ICommand<TContext>, context: TContext) {
    command.execute(context);
    this.push(command);
  }

  record(command: ICommand<TContext>) {
    this.push(command);
  }

  undo(context: TContext) {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo(context);
    this.redoStack.push(command);
  }

  redo(context: TContext) {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute(context);
    this.undoStack.push(command);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  private push(command: ICommand<TContext>) {
    const lastCommand = this.undoStack.at(-1);

    if (
      lastCommand?.canMergeWith?.(command) &&
      lastCommand.merge &&
      command.timestamp - lastCommand.timestamp <= this.config.mergeWindow
    ) {
      this.undoStack[this.undoStack.length - 1] = lastCommand.merge(command);
    } else {
      this.undoStack.push(command);
    }

    this.redoStack = [];
    this.trim();
  }

  private trim() {
    while (this.undoStack.length > this.config.maxSize) {
      this.undoStack.shift();
    }
  }
}
