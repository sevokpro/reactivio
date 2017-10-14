import {Observable} from "rxjs";
import {Observer} from "rxjs";
import {Subject} from "rxjs/Subject";

interface INode{
    tag: 'span' | 'div' | '#text' | 'button',
    attributes?: {
        [attributeKey: string]: string
    },
    children?: Array<INode>
}

class Component{
    constructor(
        public tmpl: INode,
        public context: object
    ) {}
}

class ComponentFactory{
    private xmlToINodeAdapter(tmpl: string): INode{
        const node: INode = {
            tag: "div"
        }

        return node
    }

    private jsonToINodeAdapter(tmpl: string): INode{
        const node: INode = {
            tag: "div"
        }
        return node
    }

    public createFromXmlTemlate(tmpl: string, context: object): Component {
        return new Component(this.xmlToINodeAdapter(tmpl), context);
    }

    public createFromJsonTemlate(tmpl: string, context: object): Component {
        return new Component(this.jsonToINodeAdapter(tmpl), context)
    }

    public createFromINodeObject(tmpl: INode, context: object): Component {
        return new Component(tmpl, context)
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

    private renderElement(node: INode, parent: HTMLElement, context: object): Observable<HTMLElement> {
        return Observable.create( (observer: Observer<HTMLElement>) => {
            let result: HTMLElement;
            switch (node.tag){
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
                    this.appendTextNode(node.attributes['value'], parent);
                    break;
                case 'button':
                    const button: HTMLElement = document.createElement('button');
                    parent.appendChild(button);
                    result = button;
                    break;
                default:
                    console.log(`unknow element ${node.tag}`);
            }
            // if (node.attributes !== undefined) {
            //     const bindContextVar = node.attributes['bind'];
            //     if ( bindContextVar !== null && bindContextVar !== undefined ) {
            //         const bindAttributeKey = bindContextVar;
            //         const contextVar = context[bindAttributeKey].subscribe( next => {
            //             while (result.hasChildNodes()) {
            //                 result.removeChild(result.firstChild);
            //             }
            //             this.appendTextNode(next, result);
            //         });
            //     }
            // }
            observer.next(result);
        });
    }

    private renderNode( node: INode, parent: HTMLElement, context: object): void {
        const hasAttributes: boolean = node.attributes !== undefined;
        if (hasAttributes) {
            const repeatAttribute = node.attributes['repeat'];
            if (repeatAttribute !== null && repeatAttribute !== undefined) {
                const repeatContextVariable: string = repeatAttribute;
                const contextVar: Observable<Array<any>> = context[repeatContextVariable];
                // TODO: require deep clone?
                const nodeClone: INode = {...node};
                delete nodeClone.attributes['repeat'];
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
                // prevent default render process
                return;
            }

            const bindContextVar = node.attributes['bind'];
            if ( bindContextVar !== null && bindContextVar !== undefined ) {
                const bindAttributeKey = bindContextVar;
                const nextElement: Observable<HTMLElement> = this.renderElement(node, parent, context)
                const contextVar: Observable<any> = context[bindAttributeKey]

                nextElement.combineLatest(contextVar).subscribe( ([nextElement, nextValue]) => {
                    while (nextElement.hasChildNodes()) {
                        nextElement.removeChild(nextElement.firstChild);
                    }
                    this.appendTextNode(nextValue, nextElement)
                });
                return;
            }
        }
        let nextElement = this.renderElement(node, parent, context);

        if(hasAttributes){
            const clickContextVar = node.attributes['click'];
            if(clickContextVar !== undefined){
                nextElement = nextElement.do( next => {
                    next.onclick = event => context[clickContextVar].next(event)
                })
            }
        }

        nextElement.subscribe( next => {
            if ( next !== null && next !== undefined && node.children !== undefined && node.children !== null ) {
                node.children.forEach( el => {
                    this.renderNode(el, next, context);
                });
            }
            //return nextElement;
        });
    }

    public render(component: Component) {
        this.renderNode(component.tmpl, this.rootNode, component.context);
    }
}

class RenderFactory{
    public static create(node: HTMLElement) {
        return new Renderer(node);
    }
}

const renderer = RenderFactory.create(document.body);
const componentFactory = new ComponentFactory();

const cmpTemplate: INode = {
    tag: "div",
    children: [{
        tag: "#text",
        attributes: {
            value: 'hello!'
        }
    },{
        tag: "div",
        attributes: {
            bind: "text"
        }
    },{
        tag: "button",
        attributes: {
            click: "clickEvent"
        },
        children: [{
            tag: "#text",
            attributes: {
                value: "next!"
            }
        }]
    },{
        tag: "div",
        children: [{
            tag: "div",
            attributes: {
                repeat: 'arr'
            },
            children: [{
                tag: "div",
                children: [{
                    tag: "span",
                    children: [{
                        tag: "#text",
                        attributes: {
                            value: "next Value: "
                        }
                    }]
                },{
                    tag: "span",
                    attributes: {
                        bind: 'nextVal'
                    }
                },{
                    tag: "span",
                    children: [{
                        tag: "#text",
                        attributes: {
                            value: " / next Key: "
                        }
                    }]
                },{
                    tag: "span",
                    attributes: {
                        bind: "nextKey"
                    }
                }]
            }]
        }]
    }]
}
class CmpContext{
    private clickEvent: Subject<MouseEvent> = new Subject();
    private text = Observable.interval(1e3).sample(this.clickEvent);
    private arr = Observable.interval(100).map(next => Observable.of(next)).bufferCount(10).sample(this.clickEvent);
    constructor(){}
}

const cmp = componentFactory.createFromINodeObject(
    cmpTemplate,
    new CmpContext()
);

renderer.render(cmp);