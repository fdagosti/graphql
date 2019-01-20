const prod_environment = {
    production: true,
    backendUrl: "https://photo-graphql.herokuapp.com",
    backendAPIUrl: "https://photo-graphql.herokuapp.com/graphql",
    backendSubsUrl: "ws://photo-graphql.herokuapp.com/graphql"
}

export const environment = {
    production: false,
    backendUrl: "http://localhost:4000",
    backendAPIUrl: "http://localhost:4000/graphql",
    backendSubsUrl: "ws://localhost:4000/graphql"
}