# Mile Quest Frontend

This is the frontend application for Mile Quest, built with Next.js 14, TypeScript, and Tailwind CSS.

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
```

## CSS Architecture

Mile Quest uses a **Tailwind CSS + CSS Modules** hybrid approach for styling.

### Primary: Tailwind CSS (90%)

Use Tailwind for most styling needs:
- Layout and spacing
- Typography and colors
- Responsive design
- State modifiers (hover, focus, active)
- Simple animations

```tsx
// ✅ Good: Using Tailwind utilities
<button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark">
  Click me
</button>
```

### Secondary: CSS Modules (10%)

Use CSS Modules only for:
- Complex keyframe animations
- Third-party component overrides
- Styles that cannot be expressed with utilities

```tsx
// ✅ Good: CSS Module for complex animation
import styles from './MapLoader.module.css';

<div className={`${styles.complexAnimation} w-12 h-12`} />
```

### Styling Guidelines

1. **Mobile-First Responsive Design**
   ```tsx
   // Start with mobile, add breakpoints for larger
   className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
   ```

2. **Component Patterns**
   ```tsx
   // Use composable className patterns
   const baseClasses = 'font-semibold rounded-lg';
   const variantClasses = {
     primary: 'bg-primary text-white',
     secondary: 'bg-gray-100 text-gray-700'
   };
   ```

3. **Performance**
   - Avoid runtime CSS-in-JS
   - Use Tailwind JIT for optimal bundle size
   - Keep initial CSS < 20KB

See [Component Patterns](./src/components/patterns/README.md) for examples.
Full guidelines: [CSS Architecture](/docs/CSS-ARCHITECTURE.md)

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── components/         
│   ├── layout/         # Layout components (Header, Footer)
│   ├── ui/             # Reusable UI components
│   ├── features/       # Feature-specific components
│   └── patterns/       # Component pattern examples
├── lib/                # Utility functions
├── hooks/              # Custom React hooks
└── types/              # TypeScript type definitions
```

## Development Workflow

1. **Creating Components**
   - Check pattern library first: `src/components/patterns/`
   - Use Tailwind utilities for styling
   - Co-locate CSS Modules only if needed
   - Follow TypeScript best practices

2. **Responsive Design**
   - Design mobile-first
   - Test at these breakpoints:
     - Mobile: 375px
     - Tablet: 768px  
     - Desktop: 1024px

3. **Performance**
   - Use Next.js Image component
   - Implement loading states
   - Add error boundaries
   - Monitor bundle size

## Testing

```bash
# Run tests (when implemented)
npm run test

# Run tests in watch mode
npm run test:watch
```

## Building for Production

```bash
# Create production build
npm run build

# Run production build locally
npm run start
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
```

## Contributing

1. Follow the CSS architecture guidelines
2. Use the established component patterns
3. Write semantic, accessible HTML
4. Test on mobile devices
5. Check TypeScript types

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Mile Quest CSS Architecture](/docs/CSS-ARCHITECTURE.md)
- [Component Patterns](./src/components/patterns/)