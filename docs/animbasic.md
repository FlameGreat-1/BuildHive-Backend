ANIMATION BRIEF FOR DEVELOPER
===============================

ANIMATION #1: HERO SECTION CONSTRUCTION TOOLS
==============================================
Deliverable: React Three Fiber component
Duration: 4-second loop
Canvas Size: 1920x1080px (responsive)

ASSETS TO CREATE:
- 3D models: Hammer, Drill, Level, Measuring tape
- Apply realistic materials/textures

FLOATING MOTION:
- Vertical movement: ±20px amplitude
- Easing: ease-in-out sine wave
- Speed: 2-second up/down cycle

ROTATION:
- 360° rotation on Y-axis
- Duration: 4 seconds per full rotation
- Timing: linear

PHYSICS SIMULATION:
- Add subtle gravity effect (slight downward pull)
- Buoyancy simulation (gentle upward resistance)
- No collision detection needed

COLOR PALETTE:
- Industrial Blue: #1E3A8A
- Orange: #F97316
- Steel Gray: #64748B

ANIMATION #2: BUILDHIVE LOGO FORMATION
======================================
Deliverable: React component with Three.js
Duration: 6-second loop (3s formation + 3s hold)

ASSETS TO CREATE:
- 8 individual building blocks with textures:
  - 2 blocks: Metal texture
  - 3 blocks: Wood grain texture
  - 3 blocks: Concrete texture

PHASE 1 (0-3 seconds): BLOCK ASSEMBLY
- Each block starts from random off-screen position
- Stagger timing: 0.2s delay between each block
- Flight path: Curved trajectory (not straight line)
- Speed: Fast start, slow magnetic snap at end
- Particle trails: 20px width, fade over 0.5s

PHASE 2 (3-6 seconds): HOLD + LOOP RESET
- Assembled logo holds for 2 seconds
- 1-second fade/reset transition

MAGNETIC SNAP EFFECT:
- Final 0.3 seconds of each block's journey
- Ease-out-back timing function
- Slight overshoot then settle

ANIMATION #3: JOBCAST NETWORK VISUALIZATION
===========================================
Deliverable: D3.js with React component
Duration: 5-second seamless loop

CONTRACTOR NODES (12 total):
- Shape: Circles, 40px diameter
- Color: #1E3A8A (Industrial Blue)
- Position: Left side of canvas, scattered vertically

JOB POSTING NODES (8 total):
- Shape: Squares, 35px size
- Color: #F97316 (Orange)
- Position: Right side of canvas, scattered vertically

CONNECTION LINES:
- Draw from contractor to job node
- Animation: 0.8s draw duration per line
- Stagger: 0.3s delay between each connection
- Line weight: 3px
- Color: #64748B with 60% opacity

PULSING GLOW:
- Active lines pulse every 1.5 seconds
- Glow radius: 8px
- Opacity: 40% to 80% fade

COUNTER ANIMATION:
- Start: "Jobs Matched: 0"
- End: "Jobs Matched: 1,247"
- Duration: 4 seconds
- Easing: Ease-out
- Font: Bold, 24px

ANIMATION #4: ENTERPRISE DASHBOARD SCREENS
==========================================
Deliverable: React Three Fiber component
Duration: 4-second loop

SCREEN DIMENSIONS: 300x200px each

3D PROPERTIES:
- Drop shadow: 10px blur, 20% opacity
- Z-rotation: ±5° subtle movement
- Float amplitude: ±15px vertical
- Perspective: 800px

SCREEN 1 - PROJECT TIMELINE:
- 4 progress bars, stacked vertically
- Animate from 0% to: 85%, 92%, 67%, 78%
- Duration: 2.5 seconds
- Easing: ease-out-cubic
- Bar color: #F97316

SCREEN 2 - BUDGET REPORT:
- 6 vertical bars in bar chart
- Heights: 40%, 75%, 60%, 90%, 55%, 80%
- Animate bottom-to-top growth
- Duration: 3 seconds
- Stagger: 0.2s delay per bar

SCREEN 3 - TEAM COLLABORATION:
- 8 user avatar circles (32px diameter)
- Animate in with scale: 0 to 1
- Add bounce effect on entry
- Duration: 2 seconds
- Stagger: 0.15s per avatar

SCREEN 4 - PERFORMANCE ANALYTICS:
- Line graph with 12 data points
- Draw path progressively left-to-right
- Duration: 3.5 seconds
- Line color: #1E3A8A
- Add subtle glow effect

ENVIRONMENTAL PARTICLES SYSTEM
==============================
Layer Order: Behind all primary elements

FLOATING DUST:
- Count: 50 particles
- Size: 2-4px circles
- Opacity: 10-30%
- Movement: Slow vertical drift
- Color: #64748B

BLUEPRINT SCRAPS:
- Count: 8 pieces
- Size: 20-40px irregular shapes
- Rotation: Slow tumble
- Movement: Diagonal float

WELDING SPARKS:
- Count: 15 particles
- Size: 3-6px
- Color: #F97316 with glow
- Movement: Quick, erratic paths
- Lifespan: 2-second fade

HOLOGRAPHIC UI ELEMENTS:
- Count: 5 geometric shapes
- Opacity: 20-40%
- Movement: Slow rotation + float
- Blend mode: Additive/Screen

TECHNICAL REQUIREMENTS:
- Render all animations at 60fps
- Optimize bundle sizes and performance
- Test on mobile devices for performance
- Provide both light/dark theme versions if needed

FILE NAMING CONVENTION:
- HeroToolsAnimation.jsx
- BuildHiveLogoFormation.jsx
- JobCastNetworkDemo.jsx
- DashboardScreens.jsx

TECH STACK AND FRAMEWORK:
=========================

PRIMARY ANIMATION FRAMEWORK:
- Three.js - Essential for 3D floating tools, physics-based motion, and holographic UI elements
- React Three Fiber - React wrapper for Three.js, perfect for enterprise applications
- Framer Motion - Handles parallax scrolling and smooth transitions between sections

PHYSICS ENGINE:
- Cannon.js or Rapier.js - For realistic physics on floating construction tools
- React Spring - For natural spring-based animations

3D ASSET PIPELINE:
- Blender - Create and export 3D construction tools (hammer, drill, level)
- GLTF/GLB format - Optimized 3D model loading
- Drei - React Three Fiber helpers for materials and effects

PARTICLE SYSTEMS:
- Three.js Points - Construction dust and sparks
- React Particles - Blueprint fragments and ambient effects

DATA VISUALIZATION:
- D3.js with React - Animated charts and network connections
- Recharts - Enterprise dashboard components

PERFORMANCE OPTIMIZATION:
- React.memo and useMemo - Prevent unnecessary re-renders
- Intersection Observer API - Load animations only when visible
- Web Workers - Offload heavy calculations
