// main.js - Processo principal do Electron
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;

// Configurações para melhor compatibilidade com X11/Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

// Garantir que apenas uma instância do app rode por vez
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Outra instância já está rodando. Encerrando...');
  app.quit();
} else {
  // Se alguém tentar abrir uma segunda instância, focar a janela existente
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// CRÍTICO: Definir antes de tudo para o GNOME reconhecer
app.name = 'gastos-mensais-v6';

// Configurar corretamente o nome da aplicação no Linux
if (process.platform === 'linux') {
  app.setName('gastos-mensais-v6');
  // Definir o nome do processo também
  process.title = 'gastos-mensais-v6';
}

// Configurar desktop file para o GNOME reconhecer corretamente
process.env.DESKTOPINTEGRATION = 'AppImageLauncher';
if (process.platform === 'linux') {
  const desktopFile = path.join(
    require('os').homedir(),
    '.local/share/applications/gastos-mensais-v6.desktop'
  );
  if (fs.existsSync(desktopFile)) {
    process.env.XDG_ACTIVATION_TOKEN = 'gastos-mensais-v6';
  }
}

// Variáveis globais
let mainWindow;
let expressServer;

// Função para criar a janela
function createWindow() {
  console.log('🔧 Iniciando criação da janela...');
  // Configurar ícone com caminho absoluto para melhor compatibilidade no Linux
  const iconName = 'coin.png';
  let iconPath;
  
  if (isDev) {
    iconPath = path.join(__dirname, 'img', iconName);
  } else {
    // Tentar diferentes caminhos possíveis no AppImage
    const possiblePaths = [
      path.join(__dirname, 'img', iconName),
      path.join(process.resourcesPath, 'app.asar', 'img', iconName),
      path.join(process.resourcesPath, 'img', iconName),
      path.join(app.getAppPath(), 'img', iconName)
    ];
    
    // Usar o primeiro caminho que existir
    iconPath = possiblePaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch (e) {
        return false;
      }
    }) || possiblePaths[0];
  }
  
  console.log('🖼️  Caminho do ícone:', iconPath);

  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: true, // Mostrar a janela imediatamente
    center: true, // Centralizar na tela
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: iconPath,
    title: 'Gastos Mensais V6'
  };

  // No Linux, adicionar propriedades específicas para WMClass
  if (process.platform === 'linux') {
    windowOptions.backgroundColor = '#1e1e1e';
    windowOptions.skipTaskbar = false; // Garantir que apareça na barra de tarefas
  }

  console.log('📱 Criando BrowserWindow...');
  mainWindow = new BrowserWindow(windowOptions);
  console.log('✅ BrowserWindow criada com sucesso!');
  
  // Forçar a janela a aparecer
  mainWindow.show();
  mainWindow.focus();
  
  // Forçar o ícone novamente após a janela ser criada (importante no Linux)
  if (iconPath && fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
  }
  
  // Linux: Garantir que o WM_CLASS está correto após criar a janela
  if (process.platform === 'linux') {
    mainWindow.setRepresentedFilename('gastos-mensais-v6');
  }

  // Esperar o servidor iniciar antes de carregar a página
  const startApp = () => {
    const url = 'http://localhost:3001/login.html';
    console.log('🌐 Carregando URL:', url);
    mainWindow.loadURL(url).then(() => {
      console.log('✅ URL carregada com sucesso!');
      // Garantir que a janela apareça após carregar
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
    }).catch(err => {
      console.error('❌ Erro ao carregar URL:', err);
    });

    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  };

  // Dar um tempo para o servidor iniciar
  console.log('⏳ Aguardando 2 segundos para o servidor iniciar...');
  setTimeout(startApp, 2000);

  mainWindow.on('closed', () => {
    console.log('🔴 Janela fechada');
    mainWindow = null;
  });

  // Garantir que ao fechar a janela, os recursos sejam liberados
  mainWindow.on('close', (event) => {
    console.log('🔴 Fechando janela...');
  });
}

// Iniciar servidor Express
function startExpressServer() {
  const express = require('express');
  const fs = require('fs-extra');
  const cors = require('cors');

  const expressApp = express();
  const PORT = 3001;
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'Gastos Mensais V6');
  const DATA_FILE = path.join(dataDir, 'data.json');

  // Criar diretório de dados se não existir
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Middleware
  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static(__dirname));

  // Garantir que o arquivo data.json existe
  async function ensureDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
      await fs.writeJSON(DATA_FILE, { expenses: [] }, { spaces: 2 });
    }
  }

  // Ler todos os gastos
  expressApp.get('/api/expenses', async (req, res) => {
    try {
      await ensureDataFile();
      const data = await fs.readJSON(DATA_FILE);
      res.json(data.expenses || []);
    } catch (error) {
      console.error('Erro ao ler gastos:', error);
      res.status(500).json({ error: 'Falha ao ler gastos' });
    }
  });

  // Adicionar novo gasto
  expressApp.post('/api/expenses', async (req, res) => {
    try {
      await ensureDataFile();
      const data = await fs.readJSON(DATA_FILE);
      const newExpense = req.body;

      if (!newExpense.id) {
        return res.status(400).json({ error: 'ID é obrigatório' });
      }

      data.expenses.push(newExpense);
      await fs.writeJSON(DATA_FILE, data, { spaces: 2 });
      res.status(201).json(newExpense);
    } catch (error) {
      console.error('Erro ao adicionar gasto:', error);
      res.status(500).json({ error: 'Falha ao adicionar gasto' });
    }
  });

  // Atualizar gasto existente
  expressApp.put('/api/expenses/:id', async (req, res) => {
    try {
      await ensureDataFile();
      const data = await fs.readJSON(DATA_FILE);
      const { id } = req.params;
      const updatedExpense = req.body;

      const index = data.expenses.findIndex(e => e.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Gasto não encontrado' });
      }

      data.expenses[index] = updatedExpense;
      await fs.writeJSON(DATA_FILE, data, { spaces: 2 });
      res.json(updatedExpense);
    } catch (error) {
      console.error('Erro ao atualizar gasto:', error);
      res.status(500).json({ error: 'Falha ao atualizar gasto' });
    }
  });

  // Deletar gasto
  expressApp.delete('/api/expenses/:id', async (req, res) => {
    try {
      await ensureDataFile();
      const data = await fs.readJSON(DATA_FILE);
      const { id } = req.params;

      const index = data.expenses.findIndex(e => e.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Gasto não encontrado' });
      }

      data.expenses.splice(index, 1);
      await fs.writeJSON(DATA_FILE, data, { spaces: 2 });
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar gasto:', error);
      res.status(500).json({ error: 'Falha ao deletar gasto' });
    }
  });

  // Limpar mês específico
  expressApp.delete('/api/expenses/month/:month', async (req, res) => {
    try {
      await ensureDataFile();
      const data = await fs.readJSON(DATA_FILE);
      const { month } = req.params;

      data.expenses = data.expenses.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return m !== month;
      });

      await fs.writeJSON(DATA_FILE, data, { spaces: 2 });
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao limpar mês:', error);
      res.status(500).json({ error: 'Falha ao limpar mês' });
    }
  });

  // Iniciar servidor
  expressServer = expressApp.listen(PORT, () => {
    console.log(`🚀 Servidor Express rodando em http://localhost:${PORT}`);
  });

  return expressServer;
}

// Quando o app está pronto
app.on('ready', () => {
  console.log('🚀 App está pronto! Iniciando aplicação...');
  try {
    startExpressServer();
    console.log('✅ Servidor Express iniciado');
    createWindow();
    console.log('✅ Janela criada');
    createMenu();
    console.log('✅ Menu criado');
  } catch (error) {
    console.error('❌ Erro durante inicialização:', error);
  }
});

// Quando todas as janelas são fechadas
app.on('window-all-closed', () => {
  console.log('🔴 Todas as janelas fechadas, encerrando app...');
  if (process.platform !== 'darwin') {
    // Fechar o servidor Express antes de sair
    if (expressServer) {
      expressServer.close(() => {
        console.log('✅ Servidor Express fechado');
        app.quit();
      });
    } else {
      app.quit();
    }
  }
});

// Quando o app é reaberto (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Evento antes de fechar o app (cleanup)
app.on('before-quit', () => {
  console.log('🔴 App vai fechar, liberando recursos...');
  if (expressServer) {
    try {
      expressServer.close();
      console.log('✅ Servidor fechado');
    } catch (error) {
      console.error('❌ Erro ao fechar servidor:', error);
    }
  }
});

// IPC - Função para fechar a aplicação
ipcMain.on('quit-app', () => {
  if (expressServer) {
    expressServer.close(() => {
      app.quit();
    });
  } else {
    app.quit();
  }
});

// IPC - Alternar tela cheia
ipcMain.on('toggle-fullscreen', () => {
  if (mainWindow) {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
  }
});

// Menu
function createMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Sair',
          accelerator: 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
