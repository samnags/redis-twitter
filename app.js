const path = require("path")
const express = require("express")
const { render } = require("pug")

const app = express()
const redis = require("redis")
const session = require("express-session")
const RedisStore = require("connect-redis")(session)

const client = redis.createClient()
const bcrypt = require("bcrypt")

app.use(express.urlencoded({ extended: true }))
app.set("view engine", "pug")
app.set("views", path.join(__dirname, "views"))

app.use(
  session({
    store: new RedisStore({ client: client }),
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 36000000,
      httpOnly: false,
      secure: false,
    },
    secret: "M5j68dDT1Mop0K6wV",
  })
)

app.get("/", (req, res) => {
  if (req.session.userid) {
    console.log("Endpoint:", req.url)
    console.log("Body:", req.body)
    console.log("Req.session.userid:", req.session.userid)

    client.hget(
      `user:${req.session.userid}`,
      "username",
      (err, currentUserName) => {
        client.smembers(`following:${currentUserName}`, (err, following) => {
          client.hkeys("users", (err, users) => {
            res.render("dashboard", {
              users: users.filter(
                (user) =>
                  user !== currentUserName && following.indexOf(user) === -1
              ),
            })
          })
        })
      }
    )
  } else {
    res.render("login")
  }
})

app.get("/post", (req, res) => {
  if (!req.session.userid) {
    res.render("login")
    return
  } else res.render("post")
})

app.post("/post", (req, res) => {
  if (!req.session.userid) {
    res.render("login")
    return
  }
  console.log("Endpoint:", req.url)
  console.log("Body:", req.body)
  console.log("Req.session.userid:", req.session.userid)
  const { message } = req.body

  client.incr("postid", async (err, postid) => {
    client.hset(
      `post:${postid}`,
      "userid",
      req.session.userid,
      "message",
      message,
      "timestamp",
      Date.now()
    )
  })
  res.redirect("/")
})

app.post("/follow", (req, res) => {
  if (!req.session.userid) {
    res.render("login")
    return
  }
  console.log("Endpoint:", req.url)
  console.log("Body:", req.body)
  console.log("Req.session.userid:", req.session.userid)

  const { username } = req.body

  client.hget(
    `user:${req.session.userid}`,
    "username",
    (err, currentUserName) => {
      client.sadd(`following:${currentUserName}`, username)
      client.sadd(`followers:${username}`, currentUserName)
    }
  )
  res.redirect("/")
})

app.post("/", (req, res) => {
  const { username, password } = req.body

  const saveSessionAndRenderDashboard = (userid) => {
    req.session.userid = userid
    req.sessfion.save()
    client.hkeys("users", (err, users) => {
      res.render("dashboard", { users })
    })
  }

  const handleSignup = (username, password) => {
    client.incr("userid", async (err, userid) => {
      client.hset("users", username, userid)

      const saltRounds = 10
      const hash = await bcrypt.hash(password, saltRounds)

      client.hset(`user:${userid}`, "hash", hash, "username", username)

      saveSessionAndRenderDashboard(userid)
    })
  }

  const handleLogin = (userid, password) => {
    client.hget(`user:${userid}`, "hash", async (err, hash) => {
      const result = await bcrypt.compare(password, hash)
      if (result) {
        console.log("Logging in")
        saveSessionAndRenderDashboard(userid)
      } else {
        res.render("error", {
          message: "Wrong password idiot",
        })
        return
      }
    })
  }

  if (!username || !password) {
    res.render("error", { message: "Please set both username and password" })
    return
  }

  client.hget("users", username, (err, userid) => {
    if (!userid) {
      handleSignup(username, password)
    } else {
      handleLogin(userid, password)
    }
  })
})

app.listen(3000, () => {
  console.log("Server ready on port 3000")
})

//  const getValues = (userid) => {
//    client.hgetall("users", (err, userid) => {
//      console.log(userid.userid)
//      console.log(userid.username)
//      console.log(userid.hash)
//    })
//  }
