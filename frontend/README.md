# CivicPulse AI — Frontend Web Application

This project is the web client interface for CivicPulse AI, built using **Angular 22** standalone components, Angular Material, RxJS, and custom responsive styling.

---

## ⚡ Quick Start & Development Server

To install dependencies and start a local development server, run:

```bash
npm install
npm start
# or: ng serve
```

Once running, navigate to [http://localhost:4200/](http://localhost:4200/). The application will automatically reload whenever you modify any source files.

---

## 🛠️ Code Scaffolding

Generate Angular standalone components, services, or directives using Angular CLI:

```bash
ng generate component features/feature-name
```

For a complete list of schematics:
```bash
ng generate --help
```

---

## 📦 Production Building

To compile the application for production deployment:

```bash
npm run build
# or: ng build --configuration production
```

Build artifacts are output to the `dist/` directory (`dist/frontend/browser`), optimized for caching and delivery via Nginx.

---

## 🔎 Code Quality & Testing

### Prettier Formatting Check
Verify HTML, SCSS, and TypeScript formatting:
```bash
npx prettier --check "src/**/*.{ts,html,scss}"
```

### Running Unit Tests
Execute unit test suite:
```bash
npm test
# or: ng test
```

---

## 🐳 Docker Deployment

The frontend includes a multi-stage production Dockerfile ([Dockerfile.frontend](file:///d:/Project/intelligent-self-healing-cicd/frontend/Dockerfile.frontend)):
1. **Builder stage**: Node 22 Alpine installs dependencies and compiles the Angular app with `--configuration production`.
2. **Production stage**: Nginx Alpine serves static assets from `/usr/share/nginx/html` with fallback routing configured in `nginx.conf`.

---

## 📚 Additional Resources

* [Angular CLI Overview & Command Reference](https://angular.dev/tools/cli)
* [Angular Documentation](https://angular.dev/)

