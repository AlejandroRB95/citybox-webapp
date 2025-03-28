import { Amplify } from "aws-amplify";
import "./App.css";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { list, uploadData, getUrl, remove } from "@aws-amplify/storage";
import awsExports from "./aws-exports";
import { useEffect, useState, useRef, useCallback } from "react";

Amplify.configure(awsExports);

function App({ signOut, user }) {
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
  const fileInputRef = useRef(null);
  const appRef = useRef(null);

  const fetchFiles = useCallback(async () => {
    try {
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
    }
  }, [currentPath]);

  const uploadFiles = async (files) => {
    try {
      if (!files || files.length === 0) return;
      const scrollPosition = window.scrollY;
      for (const file of files) {
        const fileKey = `${currentPath}${file.name}`;
        await uploadData({
          key: fileKey,
          data: file,
          options: { contentType: file.type },
        });
      }
      setUploadMessage("Archivos subidos exitosamente");
      setTimeout(() => {
        setUploadMessage("");
        fetchFiles();
        window.scrollTo(0, scrollPosition);
      }, 3000);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadMessage("Error al subir los archivos");
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

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
      }, 3000);
    } catch (error) {
      console.error("Error creating folder:", error);
      setUploadMessage("Error al crear la carpeta");
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const deleteFile = async (key) => {
    try {
      await remove({ key });
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const deleteFolder = async (folder) => {
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
  };

  const filteredFiles = fileList.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folderList.filter(folder =>
    folder.toLowerCase().includes(folderSearchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchFiles();
  }, [currentPath, fetchFiles]);

  useEffect(() => {
    setFileCount(filteredFiles.length);
  }, [filteredFiles]);

  return (
    <div className="App" ref={appRef}>
      <h1>CITY BOX TECHNOLOGY 📦</h1>
      
      <div className="top-buttons">
        <button onClick={signOut}>Cerrar sesión</button>
        <button onClick={goToRoot}>Volver a Inicio</button>
      </div>

      <div className="main-content">
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
                  <button onClick={() => deleteFolder(folder)}>❌</button>
                </li>
              ))
            )}
          </div>
        </div>

        <div className="right-column">
          <div className="upload-buttons">
            <input type="file" ref={fileInputRef} multiple onChange={(e) => setFileData([...e.target.files])} />
            <button onClick={() => uploadFiles(fileData)}>Subir archivos</button>
            {currentPath !== `users/${user.username}/` && (
              <button onClick={goBack}>Volver</button>
            )}
          </div>

          {uploadMessage && <p className={uploadMessage.includes("Error") ? "error-message" : ""}>{uploadMessage}</p>}

          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar archivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="files-header">
            <h3>Archivos: <span className="file-count">({fileCount} {fileCount === 1 ? 'archivo' : 'archivos'})</span></h3>
            <button onClick={fetchFiles} className="reload-button">⟳ Recargar</button>
          </div>
          <div className="file-list">
            {filteredFiles.length === 0 ? (
              <p>No se encontraron archivos.</p>
            ) : (
              <ul>
                {filteredFiles.map((file, index) => (
                  <li key={index}>
                    📄 <strong>{file.name}</strong>
                    <br />
                    📅 Última modificación: {file.lastModified}
                    <br />
                    📦 Tamaño: {file.size} MB
                    <br />
                    <button onClick={() => downloadFile(file.key, file.name)}>Descargar</button>
                    <button onClick={() => deleteFile(file.key)}>Eliminar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="footer">
        <p>&copy; 2025 City Box Technology 📦. Todos los derechos reservados.</p>
      </div>
    </div>
  );
}
export default withAuthenticator(App, {
  signUpAttributes: ["email"],
  components: {
    Header() {
      return <h1 style={{ textAlign: "center", marginBottom: "50px" }}>CITY BOX TECHNOLOGY 📦</h1>;
    },
  },
  loginMechanisms: ['email'],
  formFields: {
    signIn: {
      username: {
        placeholder: 'Correo Electrónico',
      },
      password: {
        placeholder: 'Contraseña',
      },
    },
    signUp: {
      username: {
        placeholder: 'Correo Electrónico',
      },
      password: {
        placeholder: 'Contraseña',
      },
      confirm_password: {
        placeholder: 'Confirmar Contraseña',
      },
    },
    forgotPassword: {
      username: {
        placeholder: 'Correo Electrónico',
      },
    },
  },
  signIn: {
    header: 'Iniciar Sesión',
    submitButtonText: 'Iniciar Sesión',
    forgotPasswordText: '¿Olvidaste tu contraseña?',
    createAccountText: 'Crear una cuenta',
  },
  signUp: {
    header: 'Crear Cuenta.',
    submitButtonText: 'Registrarse',
    signInText: '¿Ya tienes una cuenta? Iniciar Sesión',
  },
  resetPassword: {
    header: 'Restablecer Contraseña',
    submitButtonText: 'Enviar Código',
    backToSignInText: 'Volver a Iniciar Sesión',
  },
  confirmSignUp: {
    header: 'Confirmar Registro',
    submitButtonText: 'Confirmar',
    backToSignInText: 'Volver a Iniciar Sesión',
  },
});
