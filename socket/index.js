const app = require('../app');
let moment = require('moment');
    moment.locale('ko');
const CryptoJS = require('crypto-js');
const mysql = require('mysql');
const fs = require('fs');
const readChunk = require('read-chunk');
const filetype = require('file-type');

const server = app.listen(3000, function () {
    console.log('Socket running on port 3000');
});
const io = require('socket.io')(server);
var con = mysql.createPool({// sql 접근 권한이 없다는 에러(if (err) throw err;~~~~~)발생시 데이터 베이스 설정 확인
    multipleStatements: true,
    connectionLimit: 10,
    host: "45.119.144.159",
    user: "Security",
    password: "Security123!",
    database: "security"
  });
  
var users ={}
var busy = {}
var rooms = []
var fileType = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/x-icon', 
'video/mp4', 'video/x-msvideo', 'video/x-matroska', 'video/x-ms-wmv', 
'audio/mpeg', 'audio/m4a', 'audio/x-wav', 'text/plain',
'application/epub+zip', 'application/zip', 'application/x-tar', 'application/gzip', 'application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel', 'application/msword']

function encrypt_text(key, iv, plaintext){
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(plaintext), key, {
        iv : iv,
        mode: CryptoJS.mode.CFB
    });
    return encrypted.toString()
}
function decrypt_text(key, iv, ciphertext){
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
        iv : iv,
        mode: CryptoJS.mode.CFB
    });
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8))
}
function file_dec(key, iv, file){
    const decrypted = CryptoJS.AES.decrypt(file, key, {
        iv : iv,
        mode: CryptoJS.mode.CFB
    });
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8))
}
function file_enc(key, iv, file){
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(file), key, {
        iv : iv,
        mode: CryptoJS.mode.CFB
    });
    return encrypted.toString()
    
}

const CreateRandomCode = () => {
    let classCode = "";

    for(let i = 0; i<6; i++)
    {
        let ran=Math.floor(Math.random() * 36);
        if(ran<10)
            ran = ran + 48;
        else
            ran = ran + 87;
        classCode += String.fromCharCode(ran);
    }
    return classCode
}

io.on('connect', (socket) => {
    const clientList = [];
    for(let key in users){
        clientList.push(users[key])
    }
    io.to(socket.id).emit("connected", clientList)

    socket.on('notify', (data) => {
        const {userID} = data;
        if(!(socket.id in users)){
            users[socket.id] = userID
            busy[socket.id] = false;
        }
        io.of('/').emit("notify", userID)
    })
    socket.on("follow", (data) => {
        let {targetID, userID, room, iv, key} = data
        socket.join(room)
        socket.key  = CryptoJS.enc.Hex.parse(key);
        socket.iv = CryptoJS.enc.Hex.parse(iv);
        for( sid in users){
            if(users[sid] == targetID){
                socket.to(sid).emit("follow", {userID: targetID, targetID: userID, room: room})
            }
        }
    })
    socket.on("join", (data) => {
        let {userID, targetID, key, iv} = data;
        socket.key  = CryptoJS.enc.Hex.parse(key);
        socket.iv = CryptoJS.enc.Hex.parse(iv);
        for( sid in users ){
            if(users[sid] == targetID){
                if(busy[sid] == false){
                    let room  = CreateRandomCode()
                    if (!(room in rooms)){
                        busy[sid] = true
                        busy[socket.id] = true
                        socket.join(room)
                        io.of('/').to(sid).emit("join", {
                            "client1":userID, 
                            "client2":targetID, 
                            "room":room, 
                            "key": key, 
                            "iv": iv
                        })
                        return;
                    }
                } else {
                    io.of('/').to(socket.id).emit("fail", targetID)
                    return;
                }
            }
        }
        io.of('/').to(socket.id).emit("offline", targetID)
    })
    socket.on('getChatList',(data) => {
        const {ID, targetID} = data;
        const sql = ` SELECT *
                      FROM chatting
                      WHERE (fromID = '${ID}' AND toID ='${targetID}') 
                      OR (toID = '${ID}' AND fromID = '${targetID}')
                      ORDER BY idchatting ASC;`;
        con.getConnection(function(err,con) {
          if (err) throw err; 
          else {
            con.query(sql, function(err, result, fields) {
                if(err) console.log(err)
                else{
                    let encrypt = []
                    for(i in result){
                        encrypt.push({
                            fromID : result[i].fromID,
                            toID: result[i].toID,
                            Time: result[i].Time,
                            msg: encrypt_text(socket.key, socket.iv, result[i].msg)
                        })
                    }
                    io.to(socket.id).emit("chatReceive", encrypt);
                }
            });
          }
          con.release();
        });   
    })
    socket.on("message", (data) => {
        const {userID, targetID, room, msg} = data;
        const now = moment().format("LLL")
        const Message = {
            "message":msg,
            "date":now,
            "ID":userID
        }
        const decrypt = decrypt_text(socket.key, socket.iv, msg);
        const sql = ` INSERT INTO chatting(fromID, toID, msg, Time)
                        VALUES("${userID}", "${targetID}", "${decrypt}", "${now}");`;
        con.getConnection(function(err,con) {
            if (err) throw err; 
            else {
                con.query(sql, function(err, result, fields) {
                    if(err){
                        console.log(err)
                    } else{
                        io.of('/').to(room).emit("message", Message);   
                    }
                });
            }
            con.release();
        });   
    })
    socket.on("uploadFile", (data) => {
        const {userID, targetID, room, type, file, name} = data;
        const now = moment().format("LLL");
        if(fileType.indexOf(type)==-1){
            io.to(socket.id).emit("upFail")
            return
        }
        const fileName = `files/${name}`
        fs.writeFileSync(fileName, Buffer.from(file_dec(socket.key, socket.iv, file).split("base64,")[1],'base64'))
        fs.writeFileSync(fileName+".enc", file)
        // var data = fs.readFileSync(fileName+".enc");
        // fs.writeFileSync(fileName+".test",file_dec(socket.key, socket.iv, data.toString()))
        const sql = `INSERT INTO chatting(fromID, toID, msg, Time)
        VALUES("${userID}", "${targetID}", "data://${fileName}", "${now}");` 
        const Message = {
            "message": encrypt_text(socket.key,socket.iv, `data://${fileName}`),
            "date":now,
            "ID":userID
        }
        con.getConnection(function(err,con) {
            if (err) throw err; 
            else {
                con.query(sql, function(err, result, fields) {
                    if(err){
                        console.log(err)
                    } else{
                        
                        io.of('/').to(room).emit("message", Message);   
                    }
                });
            }
            con.release();
        });   
    })
    socket.on("download", (data) => {
        const {fileName} = data;
        const path = `files/${fileName}`;
        var data = fs.readFileSync(path);
         
        const buffer = readChunk.sync(path, 0, filetype.minimumBytes);
        const ft = filetype(buffer)
        let type;
        if(ft){
            type = ft.mime
        } else{
            type = "application/octet-stream"
        }
        io.of('/').to(socket.id).emit("download", {"fileName":fileName, "file":file_enc(socket.key, socket.iv, new Buffer(data).toString('base64')), "type":type  
         })
    })

    socket.on('dis_join', (data) => {
        const {room, userID} = data;
        socket.to(room).emit("dis_join", userID)
        socket.leave(room);
        busy[socket.id] = false
        delete rooms[room]
    })
    socket.on('clearRoom', (data) =>{
        const room = data
        socket.leave(room)
        busy[socket.id] = false
    })
    socket.on('disconnect', (data) => {
        const client = users[socket.id];
        delete users[socket.id];
        io.of('/').emit("disconnect", client);
    });
});