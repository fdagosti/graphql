import React from 'react'
import { render } from 'react-dom'
import App from './App'
import { ApolloProvider } from 'react-apollo'
import ApolloClient from 'apollo-boost'
import { persistCache } from 'apollo-cache-persist'
import {
    InMemoryCache,
    HttpLink,
    ApolloLink,
    split
} from 'apollo-boost'
import { WebSocketLink } from 'apollo-link-ws'
import { getMainDefinition } from 'apollo-utilities'

const httpLink = new HttpLink({ uri: 'http://localhost:4000/graphql' })
const wsLink = new WebSocketLink({
    uri: `ws://localhost:4000/graphql`,
    options: { reconnect: true }
})


const cache = new InMemoryCache()
persistCache({
    cache,
    storage: localStorage
})

if (localStorage['apollo-cache-persist']) {
    let cacheData = JSON.parse(localStorage['apollo-cache-persist'])
    cache.restore(cacheData)
}

const client = new ApolloClient({
    cache,
    uri: 'http://localhost:4000/graphql',
    request: operation => {
        operation.setContext(context => ({
            headers: {
                ...context.headers,
                authorization: localStorage.getItem('token')
            }
        }))
    }
})

render(
    <ApolloProvider client={client}>
        <App />
    </ApolloProvider>,
    document.getElementById('root')
)
