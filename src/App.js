import { Amplify } from "aws-amplify";
import "./App.css";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { list, uploadData, getUrl, remove } from "@aws-amplify/storage";
import awsExports from "./aws-exports";
import { useEffect, useState, useRef } from "react";
Amplify.configure(awsExports);

function App({ signOut, user }) {
  const [fileData, setFileData] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [originalFileList, setOriginalFileList] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const dropRef = useRef(null);
  const fileInputRef = useRef(null);

  const userFolder = `users/${user.username}/`;

  const fetchFiles = async () => {
    try {
      const result = await list({ prefix: userFolder });
      const items = result.items.map(file => ({
        key: file.key,
        name: file.key.replace(userFolder, ""),
        lastModified: file.lastModified,
        size: file.size,
      }));
      setFileList(items);
      setOriginalFileList(items);
    } catch (error) {
      console.error("Error fetching file list:", error);
    }
  };

  const uploadFile = async (file) => {
    try {
      if (!file) return;
      await uploadData({
        key: `${userFolder}${file.name}`,
        data: file,
        options: { contentType: file.type },
      });
      console.log("Upload success");
      setUploadMessage("Archivo subido exitosamente");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadMessage("Error al subir el archivo");
    }
  };

  const deleteFile = async (key) => {
    try {
      await remove({ key });
      console.log("File deleted successfully");
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [user]);

  return (
    <div className="App">
      <button onClick={signOut}>Cerrar sesión</button>
      <h1>CITY BOX TECHNOLOGY 📦</h1>
      <h2>Carpeta de usuario</h2>

      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = e.dataTransfer.files;
          if (files.length > 0) uploadFile(files[0]);
        }}
        className={`drop-area ${dragging ? "dragging" : ""}`}
      >
        {dragging ? "Drop your file here..." : "Arrastra y suelta tus archivos aquí"}
      </div>

      <div className="file-upload-container">
        <input type="file" ref={fileInputRef} onChange={(e) => setFileData(e.target.files[0])} />
        <button onClick={() => uploadFile(fileData)}>Subir archivo</button>
      </div>

      {uploadMessage && <p>{uploadMessage}</p>}

      <input
        type="text"
        placeholder="Buscar archivos..."
        value={searchTerm}
        onChange={(event) => {
          const term = event.target.value.toLowerCase();
          setSearchTerm(term);
          setFileList(term === "" ? originalFileList : originalFileList.filter(file => file.name.toLowerCase().includes(term)));
        }}
      />

      <h2>Archivos:</h2>
      {fileList.length === 0 ? (
        <p>No se encontraron archivos.</p>
      ) : (
        <ul className="file-list">
          {fileList.map((file, index) => (
            <>
              <li key={index} className="file-item">
                <strong>{file.name}</strong> <br />
                📅 {new Date(file.lastModified).toLocaleString()} <br />
                📦 {file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${(file.size / 1024).toFixed(2)} KB`} <br />
                <button onClick={async () => {
                  try {
                    const url = await getUrl({ key: file.key, options: { expiresIn: 300 } });
                    const link = document.createElement("a");
                    link.href = url.url;
                    link.download = file.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } catch (error) {
                    console.error("Error getting file URL:", error);
                    alert("Error al obtener la URL del archivo. Verifica los permisos del bucket.");
                  }
                }}>Descargar</button>
                <button onClick={() => deleteFile(file.key)}>Eliminar</button>
              </li>
              <hr className="file-divider" />
            </>
          ))}
        </ul>
      )}
    </div>
  );
}

export default withAuthenticator(App);