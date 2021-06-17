const path = require("path")
const express = require("express")
const { render } = require("pug")

const app = express()
const redis = require("redis")

const client = redis.createClient()
const bcrypt = require("bcrypt")

app.use(express.urlencoded({ extended: true }))
app.set("view engine", "pug")
app.set("views", path.join(__dirname, "views"))

app.get("/", (req, res) => res.render("index"))
app.listen(3000, () => {
  console.log("Server ready on port 3000")
})

app.post("/", (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    res.render("error", { message: "Please set both username and password" })
    return
  }

  console.log("Body:", req.body, "Username:", username, "PW:", password)

  client.hget("users", username, (err, userid) => {
    if (!userid) {
      //user does not exist, signup procedure
      client.incr("userid", async (err, userid) => {
        client.hset("users", username, userid)
        const saltRounds = 10
        const hash = await bcrypt.hash(password, saltRounds)
        client.hset(`user:${userid}`, "hash", hash, "username", username)
      })
    } else {
      client.hget(`user:${userid}`, "hash", async (err, hash) => {
        const result = await bcrypt.compare(password, hash)
        if (result) {
          //password ok
        } else {
          //wrong password
        }
      })
    }
  })
  res.end()
})
