const { GraphQLScalarType } = require('graphql')
const { authorizeWithGithub, generateFakeUsers } = require('../lib')
const { uploadStream } = require('../lib')
const path = require('path')
const { ObjectID } = require('mongodb')
require('dotenv').config()

module.exports = {
    Query: {
        me: (parent, args, { currentUser }) => currentUser,
        totalPhotos: (parent, args, { db }) =>
            db.collection('photos')
                .estimatedDocumentCount(),

        allPhotos: (parent, args, { db }) =>db.collection('photos')
                .find()
                .toArray(),

        totalUsers: (parent, args, { db }) =>
            db.collection('users')
                .estimatedDocumentCount(),

        allUsers: (parent, args, { db }) =>
            db.collection('users')
                .find()
                .toArray()
    },
    Mutation: {
        async postPhoto(parent, args, { db, currentUser, pubsub }) {

            // 1. If there is not a user in context, throw an error
            if (!currentUser) {
                throw new Error('only an authorized user can post a photo')
            }

            // 2. Save the current user's id with the photo
            const newPhoto = {
                ...args.input,
                userID: currentUser.githubLogin,
                created: new Date()
            }
            // 3. Insert the new photo, capture the id that the database created
            const { insertedId } = await db.collection('photos').insertOne(newPhoto)

            newPhoto.id = insertedId.toString()

            var toPath = path.join(
                __dirname, '..', 'assets', 'photos', `${newPhoto.id}.jpg`
            )

            const { stream } = await args.input.file

            await uploadStream(stream, toPath)

            pubsub.publish('photo-added', { newPhoto })

            return newPhoto

        },
        async tagPhoto(parent, args, { db }) {

            await db.collection('tags')
                .replaceOne(args, args, { upsert: true })

            return db.collection('photos')
                .findOne({ _id: ObjectID(args.photoID) })

        },
        async githubAuth(parent, {code}, {db}){
            // 1. Obtain data from GitHub
            let {
                message,
                access_token,
                avatar_url,
                login,
                name
            } = await authorizeWithGithub({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                code
            })
            // 2. If there is a message, something went wrong
            if (message) {
                throw new Error(message)
            }
            // 3. Package the results into a single object
            let latestUserInfo = {
                name,
                githubLogin: login,
                githubToken: access_token,
                avatar: avatar_url
            }
            // 4. Add or update the record with the new information
            const { ops:[user] } = await db
                .collection('users')
                .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true })
            // 5. Return user data and their token
            return { user, token: access_token }
        },
        addFakeUsers: async (root, {count}, {db, pubsub}) => {
            var { results } = await generateFakeUsers(count)
            var users = results.map(r => ({
                githubLogin: r.login.username,
                name: `${r.name.first} ${r.name.last}`,
                avatar: r.picture.thumbnail,
                githubToken: r.login.sha1
            }))

            await db.collection('users').insertMany(users)
            var newUsers = await db.collection('users')
                .find()
                .sort({ _id: -1 })
                .limit(count)
                .toArray()

            newUsers.forEach(newUser => pubsub.publish('user-added', {newUser}))

            return users
        },
        async fakeUserAuth (parent, { githubLogin }, { db }) {

            var user = await db.collection('users').findOne({ githubLogin })

            if (!user) {
                throw new Error(`Cannot find user with githubLogin "${githubLogin}"`)
            }

            return {
                token: user.githubToken,
                user
            }

        }
    },
    Subscription: {
        newPhoto: {
            subscribe: (parent, args, { pubsub }) => {
                console.log("subscribe ")
                return pubsub.asyncIterator('photo-added')
            }

        },
        newUser: {
            subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator('user-added')
        }
    },
    Photo: {
        id: parent => parent.id || parent._id.toString(),
        url: parent => `/img/photos/${parent._id}.jpg`,
        postedBy: (parent, args, { db }) =>
            db.collection('users').findOne({ githubLogin: parent.userID }),
        taggedUsers: async (parent, args, { db }) => {

            const tags = await db.collection('tags').find().toArray()

            const logins = tags
                .filter(t => t.photoID === parent._id.toString())
                .map(t => t.githubLogin)

            return db.collection('users')
                .find({ githubLogin: { $in: logins }})
                .toArray()

        }
    },
    User: {
        postedPhotos: (parent, args, { db }) =>
            db.collection("photos")
                .find({ userID: parent.githubLogin })
                .toArray(),
        inPhotos: async (parent, args, { db }) => {

            const tags = await db.collection('tags').find().toArray()

            const photoIDs = tags
                .filter(t => t.githubLogin === parent.githubLogin)
                .map(t => ObjectID(t.photoID))

            return db.collection('photos')
                .find({ _id: { $in: photoIDs }})
                .toArray()

        }
    },
    DateTime: new GraphQLScalarType({
        name: 'DateTime',
        description: 'A valid date time value.',
        parseValue: value => new Date(value),
        serialize: value => new Date(value).toISOString(),
        parseLiteral: ast => ast.value
    })
}
