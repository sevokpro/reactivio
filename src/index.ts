import {Observable} from "rxjs";
import {Observer} from "rxjs";

class Component{
    constructor(
        public tmpl: string,
        public context: object
    ) {}
}

class ComponentFactory{
    public static create(tmpl: string, context: object): Component {
        return new Component(tmpl, context);
    }
}

class Renderer{
    constructor(
        private rootNode: HTMLElement
    ) {}

    private appendTextNode(conent: string, parent: HTMLElement): void {
        const textNode = document.createTextNode(conent);
        parent.appendChild(textNode);
    }

    private renderElement(node: Node, parent: HTMLElement, context: object): Observable<HTMLElement> {
        return Observable.create( (observer: Observer<HTMLElement>) => {
            let result: HTMLElement;
            switch (node.nodeName){
                case 'div':
                    const element = document.createElement('div');
                    parent.appendChild(element);
                    result = element;
                    break;
                case 'span':
                    const spanNode: HTMLElement = document.createElement('span');
                    parent.appendChild(spanNode);
                    result = spanNode;
                    break;
                case '#text':
                    this.appendTextNode(node.nodeValue, parent);
                    break;
                default:
                    console.log(`unknow element ${node.nodeName}`);
            }
            if (node.attributes !== undefined) {
                const bindAttribute = node.attributes.getNamedItem('bind');
                if ( bindAttribute !== null ) {
                    const bindAttributeKey = bindAttribute.value;
                    const contextVar = context[bindAttributeKey].subscribe( next => {
                        while (result.hasChildNodes()) {
                            result.removeChild(result.firstChild);
                        }
                        this.appendTextNode(next, result);
                    });
                }
            }
            observer.next(result);
        });
    }

    private renderNode( node: Node, parent: HTMLElement, context: object): void {
        if (node.attributes !== undefined) {
            const repeatAttribute = node.attributes.getNamedItem('repeat');
            if (repeatAttribute !== null) {
                const repeatAttributeKey = repeatAttribute.value;
                const contextVar: Observable<Array<any>> = context[repeatAttributeKey];
                const nodeClone = node.cloneNode(true);
                nodeClone.attributes.removeNamedItem('repeat');
                contextVar
                    .subscribe( value => {
                        while (parent.hasChildNodes()) {
                            parent.removeChild(parent.firstChild);
                        }
                        const processes = value.map( (el, key) => {
                            const nextContext = Object.create(context, {
                                nextVal: {
                                    value: el,
                                    enumerable: false,
                                    writable: false,
                                    configurable: false
                                },
                                nextKey: {
                                    value: Observable.of(key),
                                    enumerable: false,
                                    writable: false,
                                    configurable: false
                                }
                            });
                            this.renderNode(nodeClone, parent, nextContext);
                        } );
                    });
                return;
            }
        }
        const nextElement = this.renderElement(node, parent, context);
        nextElement.subscribe( next => {
            if ( next !== null && next !== undefined ) {
                Array.from(node.childNodes).forEach( el => {
                    this.renderNode(el, next, context);
                });
            }
            return nextElement;
        });
    }

    public render(component: Component) {
        const parser = new DOMParser();
        const dom: Document = parser.parseFromString(component.tmpl, 'text/xml');
        this.renderNode(dom.firstChild, this.rootNode, component.context);
    }
}

class RenderFactory{
    public static create(node: HTMLElement) {
        return new Renderer(node);
    }
}

const renderer = RenderFactory.create(document.body);

const tmpl: string = `
    <div>
        <div>hello</div>
        <span bind="text"></span>
        <div>
            <div repeat="arr">
                <span bind="nextVal"></span>
                <span bind="nextKey"></span>
                <span bind="lol"></span>
            </div>
        </div>
    </div>`;
const context: object = {
    text: Observable.interval(1e3),
    arr: Observable.interval(100).map(next => Observable.of(next)).bufferCount(10),
    lol: Observable.of('lol!')
};
const cmp = ComponentFactory.create(
    tmpl,
    context
);

renderer.render(cmp);