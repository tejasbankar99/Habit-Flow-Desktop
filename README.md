# HabitFlow Desktop

<p align="center">
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</p>

> **A beautiful, glassmorphic desktop habit tracker that lives as an always-on-top widget and expands into a full-featured monthly dashboard.**

##  Features

- **Widget Mode**: An unobtrusive, frameless widget that floats on your desktop, showing your daily progress and habit checkboxes.
- **Dashboard Mode**: Expand the widget to reveal a full spreadsheet-style monthly grid, weekly consistency charts, and heatmaps.
- **Always on Top**: Pin the widget to your screen so you never forget your habits.
- **Analytics & Insights**: Automatically tracks completion rates, streaks, and generates beautiful SVG charts.
- **Multiple Themes**: Includes 4 premium design themes: Obsidian Night, Glass Light, Cyberpunk Neon, and Forest Emerald.
- **Local Privacy**: 100% offline. All habit history is saved locally as a JSON file in your AppData folder. No accounts, no subscriptions, no cloud syncing.

##  Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tejasbankar99/Habit-Flow-Desktop.git
   cd Habit-Flow-Desktop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

###  Windows Users: Easy Launcher
To create a shortcut on your desktop that launches HabitFlow cleanly without an extra terminal window floating around, run the included PowerShell script:
```powershell
./create-desktop-shortcut.ps1
```

##  Tech Stack & Architecture

- **Framework**: Electron (v31)
- **Frontend**: Vanilla HTML/CSS/JS (Zero framework overhead)
- **Icons**: Lucide Icons
- **Design System**: Custom CSS variables with glassmorphism effects (`backdrop-filter`)
- **IPC Architecture**: Secure ContextBridge exposing methods from `main.js` to `preload.js` and `app.js`.

##  Project Structure
- `main.js`: Electron backend, Window management, OS-level JSON file persistence.
- `preload.js`: Secure IPC context bridge.
- `src/`:
  - `index.html`: The monolithic view containing Widget, Dashboard, and Modals.
  - `style.css`: The complete design system and theme definitions.
  - `app.js`: Core frontend logic, rendering engines, and local state management.

##  License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Created by [Tejas Bankar](https://github.com/tejasbankar99)*
