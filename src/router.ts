type Route = {
    path: string;
    view: typeof AbstractView;
};

type RouteParams = {
    [key: string]: string;
};

export abstract class AbstractView {
    params: RouteParams;
    constructor(params: RouteParams) {
        this.params = params;
    }
    abstract render(): HTMLElement | Promise<HTMLElement>;
    static create(params: RouteParams): AbstractView {
        return new (this as any)(params);
    }
}

export class Router {
    private routes: Route[];

    constructor(routes: Route[]) {
        this.routes = routes;
    }

    private parseParams(route: Route, path: string): RouteParams | null {
        const routeParts = route.path.split('/');
        const pathParts = path.split('/');

        if (routeParts.length !== pathParts.length) return null;

        const params: RouteParams = {};
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                const paramName = routeParts[i].slice(1);
                params[paramName] = pathParts[i];
            } else if (routeParts[i] !== pathParts[i]) {
                return null;
            }
        }
        return params;
    }

    private match(path: string): { route: Route; params: RouteParams } | null {        
        for (const route of this.routes) {
            const params = this.parseParams(route, path);
            if (params !== null) {
                return { route, params };
            }
        }
        return null;
    }

    async route(): Promise<void> {
        const path = window.location.pathname;
        const matched = this.match(path);

        if (!matched) {
            // Handle 404
            document.querySelector('#app')!.innerHTML = '<h1>404 - Page Not Found</h1>';
            return;
        }

        const view = matched.route.view.create(matched.params);
        const element = await view.render();
        
        const app = document.querySelector('#app')!;
        app.innerHTML = '';
        app.appendChild(element);
        
        // Reset scroll position to top after navigation
        window.scrollTo(0, 0);
    }
}