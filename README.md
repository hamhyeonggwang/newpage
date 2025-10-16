# Portfolio Homepage

A futuristic portfolio website featuring an interactive 3D Möbius strip that transforms from an "O" to a "T" based on viewing angle. Built with Next.js, Three.js, and Tailwind CSS.

## Features

- **Interactive 3D Möbius Strip**: A living logo that shows "O" when viewed front-on and "T" when viewed edge-on
- **Particle System**: Dynamic particle field surrounding the 3D object
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Performance Optimized**: Respects user's motion preferences and includes fallback static image
- **Modern UI**: Futuristic design with glassmorphism effects and gradient accents

## Tech Stack

- **Next.js 14** - React framework with App Router
- **Three.js** - 3D graphics and WebGL rendering
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript
- **Vercel** - Deployment platform

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This project is configured for deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically

## Customization

- Replace `/public/hero-ot.png` with your own hero image
- Modify the color scheme in the shader materials
- Update the portfolio content in the component
- Customize the particle system parameters

## Performance Notes

- The 3D scene automatically falls back to a static image on devices with reduced motion preferences
- WebGL context is properly disposed of to prevent memory leaks
- Responsive design ensures optimal performance across devices

## License

MIT License - feel free to use this template for your own portfolio.

