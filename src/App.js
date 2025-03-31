import { Amplify } from "aws-amplify";
import "./App.css";
import { withAuthenticator, useAuthenticator, TextField } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { list, uploadData, getUrl, remove } from "@aws-amplify/storage";
import awsExports from "./aws-exports";
import { useEffect, useState, useRef, useCallback } from "react";

// Importa tus imágenes (asegúrate de tener estos archivos en tu carpeta src)
import welcomeImage from "./MIKU1.gif";
import goodbyeImage from "./MIKU 2.gif";

Amplify.configure(awsExports);

function App({ signOut, user }) {
  // Estados para la gestión de archivos
  const [fileData, setFileData] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [folderList, setFolderList] = useState([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [currentPath, setCurrentPath] = useState(`users/${user.username}/`);
  const [folderHistory, setFolderHistory] = useState([`users/${user.username}/`]);
  const [searchTerm, setSearchTerm] = useState("");
  const [folderSearchTerm, setFolderSearchTerm] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [folderError, setFolderError] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [isReloading, setIsReloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Estados para las pantallas de transición
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [showGoodbyeScreen, setShowGoodbyeScreen] = useState(false);
  
  const fileInputRef = useRef(null);
  const appRef = useRef(null);

  // Manejar cambio de tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowSidebar(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mostrar pantalla de bienvenida al cargar
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcomeScreen(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Función para cerrar sesión con pantalla de despedida
  const handleSignOut = () => {
    setShowGoodbyeScreen(true);
    setTimeout(() => {
      signOut();
    }, 2000);
  };

  // Inicializar la aplicación después de la pantalla de bienvenida
  useEffect(() => {
    if (showWelcomeScreen) return;
    
    const initializeApp = async () => {
      try {
        const fondosPath = `users/${user.username}/FONDOS/`;
        const result = await list({ prefix: fondosPath }); 
        
        if (result.items.length === 0) {
          await uploadData({ 
            key: fondosPath, 
            data: "", 
            options: { contentType: "application/x-directory" } 
          });
          console.log("Created default FONDOS folder");
        }

        const savedBackground = sessionStorage.getItem(`background_${user.username}`);
        if (savedBackground) {
          setBackgroundImage(savedBackground);
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      }
    };

    initializeApp();
  }, [user.username, showWelcomeScreen]);

  // Obtener lista de archivos
  const fetchFiles = useCallback(async () => {
    if (showWelcomeScreen) return;
    
    try {
      setIsReloading(true);
      const result = await list({ prefix: currentPath });
      const folders = new Set();
      const files = [];

      result.items.forEach((file) => {
        const relativePath = file.key.replace(currentPath, "");
        if (relativePath.includes("/")) {
          folders.add(relativePath.split("/")[0] + "/");
        } else {
          files.push({
            key: file.key,
            name: relativePath,
            lastModified: new Date(file.lastModified).toLocaleString(),
            size: (file.size / (1024 * 1024)).toFixed(2),
          });
        }
      });

      setFolderList(Array.from(folders));
      setFileList(files);
      setFileCount(files.length);
    } catch (error) {
      console.error("Error fetching file list:", error);
    } finally {
      setTimeout(() => setIsReloading(false), 1000);
    }
  }, [currentPath, showWelcomeScreen]);

  // Formatear la ruta actual para mostrar
  const formatPath = () => {
    const parts = currentPath.split('/');
    let formattedPath = [];
    let currentPart = '';
    
    for (let i = 2; i < parts.length; i++) {
      if (parts[i]) {
        currentPart += parts[i] + '/';
        formattedPath.push({
          name: parts[i],
          path: `users/${user.username}/${currentPart}`
        });
      }
    }
    
    return formattedPath;
  };

  // Subir archivos
  const uploadFiles = async (files) => {
    try {
      if (!files || files.length === 0) return;
      
      setIsUploading(true);
      setUploadProgress(0);
      const scrollPosition = window.scrollY;
      const totalFiles = files.length;
      let filesUploaded = 0;
      
      for (const file of files) {
        const fileKey = `${currentPath}${file.name}`;
        await uploadData({
          key: fileKey,
          data: file,
          options: { contentType: file.type },
        });
        
        filesUploaded++;
        setUploadProgress((filesUploaded / totalFiles) * 100);
      }
      
      setUploadMessage("Archivos subidos exitosamente");
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      
      setTimeout(() => {
        setUploadMessage("");
        fetchFiles();
        window.scrollTo(0, scrollPosition);
        setIsUploading(false);
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadMessage("Error al subir los archivos");
      setIsUploading(false);
      setUploadProgress(0);
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  // Crear carpeta
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setFolderError(true);
      setUploadMessage("");
      return;
    }
    
    setFolderError(false);
    const folderKey = `${currentPath}${newFolderName}/`;
    try {
      const scrollPosition = window.scrollY;
      await uploadData({ key: folderKey, data: "", options: { contentType: "application/x-directory" } });
      setNewFolderName("");
      setUploadMessage("Carpeta creada exitosamente");
      setTimeout(() => {
        setUploadMessage("");
        fetchFiles();
        window.scrollTo(0, scrollPosition);
      }, 1000);
    } catch (error) {
      console.error("Error creating folder:", error);
      setUploadMessage("Error al crear la carpeta");
      setTimeout(() => setUploadMessage(""), 1000);
    }
  };

  // Eliminar archivo
  const deleteFile = async (key) => {
    try {
      await remove({ key });
      
      if (backgroundImage === key) {
        setBackgroundImage("");
        sessionStorage.removeItem(`background_${user.username}`);
      }
      
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  // Eliminar carpeta
  const deleteFolder = async (folder) => {
    if (folder === "FONDOS/") {
      setUploadMessage("No se puede eliminar la carpeta FONDOS");
      setTimeout(() => setUploadMessage(""), 3000);
      return;
    }

    try {
      const folderKey = `${currentPath}${folder}`;
      let result = await list({ prefix: folderKey });
      const objectsToDelete = result.items.map(item => item.key);

      while (result.nextToken) {
        result = await list({ prefix: folderKey, nextToken: result.nextToken });
        objectsToDelete.push(...result.items.map(item => item.key));
      }

      for (const key of objectsToDelete) {
        await remove({ key });
      }

      console.log(`Se eliminaron ${objectsToDelete.length} objetos.`);
      fetchFiles();
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  // Descargar archivo
  const downloadFile = async (key, name) => {
    try {
      const url = await getUrl({ key, options: { expiresIn: 300 } });
      const link = document.createElement("a");
      link.href = url.url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error getting file URL:", error);
    }
  };

  // Aplicar fondo de pantalla
  const applyBackground = async (fileKey) => {
    try {
      const urlResult = await getUrl({ 
        key: fileKey, 
        options: { expiresIn: 86400 }
      });
      
      const imageUrl = urlResult.url.toString();
      setBackgroundImage(imageUrl);
      sessionStorage.setItem(`background_${user.username}`, imageUrl);
      
      setUploadMessage("Fondo de pantalla aplicado correctamente");
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (error) {
      console.error("Error applying background:", error);
      setUploadMessage("Error al aplicar el fondo de pantalla");
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  // Quitar fondo de pantalla
  const removeBackground = () => {
    setBackgroundImage("");
    sessionStorage.removeItem(`background_${user.username}`);
    setUploadMessage("Fondo de pantalla eliminado");
    setTimeout(() => setUploadMessage(""), 3000);
  };

  // Navegación
  const goBack = () => {
    const previousPath = folderHistory[folderHistory.length - 2];
    setCurrentPath(previousPath);
    setFolderHistory(folderHistory.slice(0, folderHistory.length - 1));
  };

  const goToRoot = () => {
    setCurrentPath(`users/${user.username}/`);
    setFolderHistory([`users/${user.username}/`]);
  };

  const navigateToFolder = (folder) => {
    const newPath = `${currentPath}${folder}`;
    setCurrentPath(newPath);
    setFolderHistory([...folderHistory, newPath]);
    if (isMobileView) {
      setShowSidebar(false);
    }
  };

  // Filtrar archivos y carpetas
  const filteredFiles = fileList.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folderList.filter(folder =>
    folder.toLowerCase().includes(folderSearchTerm.toLowerCase())
  );

  // Efectos secundarios
  useEffect(() => {
    if (showWelcomeScreen) return;
    fetchFiles();
  }, [currentPath, fetchFiles, showWelcomeScreen]);

  useEffect(() => {
    setFileCount(filteredFiles.length);
  }, [filteredFiles]);

  useEffect(() => {
    if (backgroundImage) {
      document.body.style.backgroundImage = `url('${backgroundImage}')`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
    } else {
      document.body.style.backgroundImage = "";
      document.body.style.backgroundColor = "";
    }
  }, [backgroundImage]);

  // Pantalla de Bienvenida
if (showWelcomeScreen) {
  return (
    <div className="transition-screen welcome-screen">
      <div className="transition-content">
        <img 
          src={welcomeImage} 
          alt="Welcome" 
          className="transition-image"
          onError={(e) => {
            e.target.onerror = null; 
            e.target.src = "https://cdn-icons-png.flaticon.com/512/6195/6195699.gif";
          }}
        />
        <h1 className="transition-title welcome-title">Bienvenido a CITY BOX TECHNOLOGY</h1>
        <p className="transition-text">Cargando tu espacio personal...</p>
      </div>
    </div>
  );
}

// Pantalla de Despedida
if (showGoodbyeScreen) {
  return (
    <div className="transition-screen goodbye-screen">
      <div className="transition-content">
        <img 
          src={goodbyeImage} 
          alt="Goodbye" 
          className="transition-image"
          onError={(e) => {
            e.target.onerror = null; 
            e.target.src = "https://cdn-icons-png.flaticon.com/512/1828/1828479.gif";
          }}
        />
        <h2 className="transition-title goodbye-title">Hasta pronto!!</h2>
        <p className="transition-text">Cerrando tu sesión 🥬 ヾ( ˃ᴗ˂ )◞ • *✰...</p>
      </div>
    </div>
  );
}
  // Interfaz principal
  return (
    <div className="app-container">
      <div className="App" ref={appRef}>
        <div className="header-container">
          <h1>CITY BOX TECHNOLOGY 📦</h1>
          
          <div className="top-buttons">
            {isMobileView && (
              <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className="sidebar-toggle"
              >
                {showSidebar ? '✕' : '☰'}
              </button>
            )}
            <button onClick={handleSignOut}>Cerrar sesión</button>
            {backgroundImage && (
              <button onClick={removeBackground} className="remove-bg-btn">
                Quitar fondo
              </button>
            )}
          </div>
        </div>

        <div className="main-content-wrapper">
          <div className="main-content">
            {/* Sidebar para móviles */}
            {isMobileView && (
              <div className={`mobile-sidebar ${showSidebar ? 'open' : ''}`}>
                <div className="left-column">
                  <input
                    type="text"
                    placeholder="Nombre de la carpeta"
                    value={newFolderName}
                    onChange={(e) => {
                      setNewFolderName(e.target.value);
                      setFolderError(false);
                    }}
                    className={folderError ? "error-input" : ""}
                  />
                  <div className="folder-create-container">
                    <button onClick={createFolder}>Crear Carpeta</button>
                    {folderError && <p className="error-message">Por favor ingrese un nombre para la carpeta</p>}
                  </div>

                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="Buscar carpetas..."
                      value={folderSearchTerm}
                      onChange={(e) => setFolderSearchTerm(e.target.value)}
                    />
                  </div>

                  <h3>Carpetas: <span className="file-count">({filteredFolders.length} {filteredFolders.length === 1 ? 'carpeta' : 'carpetas'})</span></h3>
                
                  <div className="folder-list">
                    {filteredFolders.length === 0 ? (
                      <p>No se encontraron carpetas.</p>
                    ) : (
                      filteredFolders.map((folder, index) => (
                        <li key={index}>
                          <button 
                            onClick={() => navigateToFolder(folder)}
                            title={folder.replace('/', '')}
                          >
                            📁 {folder.replace('/', '')}
                          </button>
                          {folder !== "FONDOS/" && (
                            <button onClick={() => deleteFolder(folder)}>❌</button>
                          )}
                        </li>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sidebar normal para desktop */}
            {!isMobileView && (
              <div className="left-column">
                <input
                  type="text"
                  placeholder="Nombre de la carpeta"
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    setFolderError(false);
                  }}
                  className={folderError ? "error-input" : ""}
                />
                <div className="folder-create-container">
                  <button onClick={createFolder}>Crear Carpeta</button>
                  {folderError && <p className="error-message">Por favor ingrese un nombre para la carpeta</p>}
                </div>

                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Buscar carpetas..."
                    value={folderSearchTerm}
                    onChange={(e) => setFolderSearchTerm(e.target.value)}
                  />
                </div>

                <h3>Carpetas: <span className="file-count">({filteredFolders.length} {filteredFolders.length === 1 ? 'carpeta' : 'carpetas'})</span></h3>
                
                <div className="folder-list">
                  {filteredFolders.length === 0 ? (
                    <p>No se encontraron carpetas.</p>
                  ) : (
                    filteredFolders.map((folder, index) => (
                      <li key={index}>
                        <button 
                          onClick={() => navigateToFolder(folder)}
                          title={folder.replace('/', '')}
                        >
                          📁 {folder.replace('/', '')}
                        </button>
                        {folder !== "FONDOS/" && (
                          <button onClick={() => deleteFolder(folder)}>❌</button>
                        )}
                      </li>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="right-column">
              {isMobileView && showSidebar && (
                <div 
                  className="sidebar-overlay"
                  onClick={() => setShowSidebar(false)}
                />
              )}

              <div className="upload-buttons">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  multiple 
                  onChange={(e) => setFileData([...e.target.files])} 
                  id="fileInput"
                />
                <label htmlFor="fileInput">Seleccionar archivos</label>
                <button 
                  onClick={() => uploadFiles(fileData)}
                  disabled={isUploading}
                >
                  {isUploading ? 'Subiendo...' : 'Subir archivos'}
                </button>
              </div>

              {isUploading && (
                <div className="upload-progress-container">
                  <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                  <div className="upload-progress-text">{Math.round(uploadProgress)}%</div>
                </div>
              )}

              {showSuccessAnimation && (
                <div className="success-animation">
                  <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                    <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                  </svg>
                </div>
              )}

              {uploadMessage && (
                <p className={uploadMessage.includes("Error") ? "error-message" : ""}>
                  {uploadMessage}
                </p>
              )}

              <div className="search-box">
                <input
                  type="text"
                  placeholder="Buscar archivos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="current-path">
                <button onClick={goToRoot} className="nav-button home-button">🏠 Inicio</button>
                {currentPath !== `users/${user.username}/` && (
                  <button onClick={goBack} className="nav-button back-button">←</button>
                )}
                {formatPath().length > 0 && (
                  <div className="path-breadcrumbs">
                    {formatPath().map((part, index) => (
                      <span key={index}>
                        {index > 0 && ' > '}
                        <span 
                          className="path-part"
                          onClick={() => {
                            setCurrentPath(part.path);
                            setFolderHistory(folderHistory.slice(0, folderHistory.indexOf(part.path) + 1));
                          }}
                        >
                          {part.name}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="files-header">
                <h3>Archivos: <span className="file-count">({fileCount} {fileCount === 1 ? 'archivo' : 'archivos'})</span></h3>
                <button 
                  onClick={fetchFiles} 
                  className="reload-button"
                  style={{
                    animation: isReloading ? 'spin 1s linear' : 'none'
                  }}
                >
                  ⟳ 
                </button>
              </div>
              <div className="file-list">
                {filteredFiles.length === 0 ? (
                  <p>No se encontraron archivos.</p>
                ) : (
                  <ul>
                    {filteredFiles.map((file, index) => (
                      <li key={index}>
                        <div>
                          <span role="img" aria-label="file">📄</span> <strong>{file.name}</strong>
                        </div>
                        <div>
                          <span role="img" aria-label="calendar">📅</span> Última modificación: {file.lastModified}
                        </div>
                        <div>
                          <span role="img" aria-label="size">📦</span> Tamaño: {file.size} MB
                        </div>
                        <div className="file-actions">
                          <button onClick={() => downloadFile(file.key, file.name)}>
                            Descargar
                          </button>
                          <button onClick={() => deleteFile(file.key)}>
                            Eliminar
                          </button>
                          {currentPath === `users/${user.username}/FONDOS/` && (
                            <button 
                              onClick={() => applyBackground(file.key)}
                              className="apply-bg-btn"
                            >
                              Aplicar fondo
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="footer">
          <p>&copy; 2025 City Box Technology 📦. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}

export default withAuthenticator(App, {
  signUpAttributes: ["email"],
  loginMechanisms: ['email'],
  socialProviders: [],
  components: {
    Header() {
      return <h2 style={{ textAlign: "center", marginBottom: "50px" }}>CITY BOX TECHNOLOGY 📦</h2>;
    },
    SignUp: {
      Header() {
        return <h3 style={{ textAlign: "center" }}>Crear nueva cuenta</h3>;
      },
      FormFields() {
        const { validationErrors } = useAuthenticator();
        
        return (
          <>
            <TextField
              label="Correo Electrónico"
              placeholder="Ingresa tu correo electrónico"
              name="email"
              required
              errorMessage={validationErrors.email}
            />
            <TextField
              label="Contraseña"
              placeholder="Crea una contraseña"
              name="password"
              type="password"
              required
            />
            <TextField
              label="Confirmar Contraseña"
              placeholder="Confirma tu contraseña"
              name="confirm_password"
              type="password"
              required
            />
          </>
        );
      },
    },
  },
  formFields: {
    signIn: {
      username: {
        label: 'Correo Electrónico',
        placeholder: 'Ingresa tu correo electrónico',
      },
      password: {
        label: 'Contraseña',
        placeholder: 'Ingresa tu contraseña',
      },
    },
    signUp: {
      email: {
        label: 'Correo Electrónico',
        placeholder: 'Ingresa tu correo electrónico',
        required: true,
      },
      password: {
        label: 'Contraseña',
        placeholder: 'Crea una contraseña',
        required: true,
      },
      confirm_password: {
        label: 'Confirmar Contraseña',
        placeholder: 'Confirma tu contraseña',
        required: true,
      },
    },
    forgotPassword: {
      username: {
        label: 'Correo Electrónico',
        placeholder: 'Ingresa tu correo electrónico',
      },
    },
  },
});
