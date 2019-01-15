import React from 'react'
import { Query } from 'react-apollo'
import { ROOT_QUERY } from './App'

const API_HOST = "http://localhost:4000"

const Photos = () =>
    <Query query={ROOT_QUERY}>
        {({loading, data}) => loading ?
            <p>loading...</p> :
            data.allPhotos.map(photo =>
                <img
                    key={photo.id}
                    src={API_HOST + photo.url}
                    alt={photo.name}
                    width={350} />

            )
        }
    </Query>

export default Photos
