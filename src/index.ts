import {Observable} from "rxjs";
import {Observer} from "rxjs";
import {Subject} from "rxjs";

// interface for private object format for render
interface INode{
    tag: 'span' | 'div' | '#text' | 'button',
    attributes?: {
        // TODO: add strict attribute keys
        [attributeKey: string]: string
    },
    children?: Array<INode>
}
// private renderer object for group template and render context
class Component{
    constructor(
        public tmpl: INode,
        public context: object
    ) {}
}
// factory for create component from different templates
class ComponentFactory{
    private xmlToINodeAdapter(tmpl: string): INode{
        // TODO: add xml(html) parser to INode
        const node: INode = {
            tag: "div"
        }
        return node
    }

    private jsonToINodeAdapter(tmpl: string): INode{
        // TODO: add json string to INode parser
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

// base render which can render ```Component```
class Renderer{
    constructor(
        private rootNode: HTMLElement
    ) {}

    // method for append simple text to element
    private appendTextNode(conent: string, parent: HTMLElement): void {
        const textNode = document.createTextNode(conent);
        parent.appendChild(textNode);
    }

    // method for render single node
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
            observer.next(result);
        });
    }

    private renderNode( node: INode, parent: HTMLElement, context: object): void {
        const hasAttributes: boolean = node.attributes !== undefined;

        // before render process hook
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
                        // clear prevent childs
                        // TODO: fix bug with clear sublings elements
                        while (parent.hasChildNodes()) {
                            parent.removeChild(parent.firstChild);
                        }
                        value.forEach( (el, key) => {
                            // create nested context for child nodes
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
                // prevent default render process && start it by hand
                return;
            }
        }
        // start render single node
        // TODO: remove nextElement variable mutation
        let nextElement = this.renderElement(node, parent, context);

        // after default render process hook
        if(hasAttributes){
            // catch click attribute for bind event subject from context
            const clickContextVar = node.attributes['click'];
            if(clickContextVar !== undefined){
                nextElement = nextElement.map( next => {
                    next.onclick = event => context[clickContextVar].next(event)
                    return next
                })
            }

            // catch bind for render nested text node
            // TODO: add warn which tell that all childs will be destroyed
            const bindContextVar = node.attributes['bind'];
            if ( bindContextVar !== null && bindContextVar !== undefined ) {
                const bindAttributeKey = bindContextVar;
                const contextVar: Observable<any> = context[bindAttributeKey]

                nextElement = nextElement
                    .combineLatest(contextVar)
                    .do( ([nextElement, nextValue]) => {
                        while (nextElement.hasChildNodes()) {
                            nextElement.removeChild(nextElement.firstChild);
                        }
                        this.appendTextNode(nextValue, nextElement)
                    })
                    .map( ([nextElement]) => nextElement );
            }
        }

        // when single node rendered start render process for childs
        nextElement.subscribe( next => {
            if ( next !== null && next !== undefined && node.children !== undefined && node.children !== null ) {
                node.children.forEach( el => {
                    // TODO: ??? add async renderNode ???
                    this.renderNode(el, next, context);
                });
            }
        });
    }

    public render(component: Component) {
        this.renderNode(component.tmpl, this.rootNode, component.context);
    }
}
// factory for create renderer on dom nodes
class RenderFactory{
    public static create(node: HTMLElement) {
        return new Renderer(node);
    }
}

// --------- example app -----------
// init core services
const renderer = RenderFactory.create(document.body);
const componentFactory = new ComponentFactory();

// create simple component with context by hands
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
};
// component which print current timer state when click
class CmpContext{
    private clickEvent: Subject<MouseEvent> =
        new Subject();

    private text =
        Observable
            .interval(1e3)
            .sample(this.clickEvent);

    private arr =
        Observable
            .interval(100)
            .map(next =>
                Observable
                    .of(next))
            .bufferCount(10)
            .sample(this.clickEvent);

    constructor(){}
}
const cmp = componentFactory.createFromINodeObject(
    cmpTemplate,
    new CmpContext()
);

// run renderer
renderer.render(cmp);