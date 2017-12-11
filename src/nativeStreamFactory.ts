interface ISubscription {
    unsubscribe(): void;
}

interface IViewStream<TValue> {
    subscribe(
        next: (next: TValue) => void,
        error: (reason: string) => void,
        complete: () => void
    ): ISubscription
}

enum IPatchCommand {
    move,
    add,
    destroy
}

interface IPatch {
    command: IPatchCommand
    target: number
    moveArgument: number
}

interface IArrayPatchStack extends Array<IPatch> { }

interface IViewArrayStream<TArrayValue> extends IViewStream<Array<TArrayValue>> {
    diffPatch(): IViewStream<IArrayPatchStack>
}

interface IPublisher<TValue> {
    next: (value: TValue) => void
    error: (error: string) => void
    complete: () => void
}

interface INativeStreamFactory {
    createValueStream<TValue>( publisherFunc: (publisher: IPublisher<TValue>) => void ) : IViewStream<TValue>
    createArrayStream<TValue>(publisher: IPublisher<Array<TValue>>): IViewArrayStream<TValue>
}

class ViewStream<TValue> implements IViewStream<TValue> {
    private nextEmitter(next: TValue){
        console.log(next);
    }
    private errorEmitter(error: TValue){
        console.warn(error)
    }
    private completeEmitter(){
        console.log('complete')
    }
    constructor(
        private executor
    ) {}

    subscribe(
        next: (next: TValue) => void,
        error: (reason: string) => void,
        complete: () => void
    ): ISubscription {
        this.executor.call(this, this.nextEmitter, this.errorEmitter, this.completeEmitter)
        return null
    }
}

class NativeStreamFactory implements INativeStreamFactory {
    createValueStream<TValue>(publisherFunc: (publisher: IPublisher<TValue>) => void): IViewStream<TValue> {
        const publisherExecuter =
            (nextEmitter, errorEmitter, completeEmitter) => {
                publisherFunc.call(this, {
                    next: nextEmitter,
                    error: errorEmitter,
                    complete: completeEmitter
                } as IPublisher<TValue>)
            }

        return new ViewStream(publisherExecuter)
    }

    createArrayStream<TValue>(publisher: IPublisher<TValue[]>): IViewArrayStream<TValue> {
        throw new Error("Method not implemented.");
    }
}

export { NativeStreamFactory }