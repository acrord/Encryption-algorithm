const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const rsa = require('../rsa');
const fs = require('fs');
var con = mysql.createPool({// sql 접근 권한이 없다는 에러(if (err) throw err;~~~~~)발생시 데이터 베이스 설정 확인
  multipleStatements: true,
  connectionLimit: 10,
  host: "45.119.144.159",
  user: "Security",
  password: "Security123!",
  database: "security"
});


//첫 로그인 화면
router.get('/', function(req, res, next) {
  res.render('login', { publicKey: rsa.PublicKEY, n: rsa.n });
});
router.post('/createUser',(req, res) => {
  const {ID} = req.body;
  const encrypted = req.body['encrypted[]']
  const PW = rsa.decrypt({key:rsa.privateKEY, n:rsa.n}, encrypted);
  const sql = `INSERT INTO user VALUES('${ID}', '${PW}')`
  console.log(PW)
  let response;
  con.getConnection(function(err,con) {
    if (err) throw err; 
    else {
      con.query(sql, function(err, result, fields) {
        if(err){
          response = {
            "success":false,
            "duplicate":true
          }
          res.send(response);
          console.log(err);
        } else{
          response = {
            "success":true,
          }
          res.send(response);
        }
      });
    }
    con.release();
  });   
})
router.post('/login',(req, res) => {
  const {ID} = req.body;
  const encrypted = req.body['encrypted[]']
  const PW = rsa.decrypt({key:rsa.privateKEY, n:rsa.n}, encrypted);
  const sql = ` SELECT userID
                FROM user
                WHERE userID = '${ID}' AND pw = '${PW}'`
  let response;
  con.getConnection(function(err,con) {
    if (err) throw err; 
    else {
      con.query(sql, function(err, result, fields) {
        if(result.length == 0){
          response = {
            "success": false,
            "message": "아이디나 비밀번호가 틀렸습니다."
          }
        }else{
          response = {
            "success":true,
          }
        }
        res.send(response);
      });
    }
    con.release();
  });   
})
router.post('/main',(req, res) => {
  const userID = req.body.ID;
  const sql = ` SELECT userID
                FROM user`
  let response;
  con.getConnection(function(err,con) {
    if (err) throw err; 
    else {
      con.query(sql, function(err, result, fields) {
        let userList = []
        for( var i = 0 ; i< result.length; i++){
          if(result[i].userID!= userID)
            userList.push(result[i].userID);
        }
        res.render('chat', {userList: userList, userID: userID});
      });
    }
    con.release();
  });   
})
router.get("/download/files/:fileName", (req,res)=>{
  const {fileName} = req.params
  var filePath = `files/${fileName}`;
  var stat = fs.readFileSync(filePath);
  res.send(JSON.stringify(stat))
})
module.exports = router;
