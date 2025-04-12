import mongoose from "mongoose";

function connect(){
    mongoose.connect(process.env.MONGODB_URL)
    .then(()=>{
        console.log("Connected to MongoDb");
    })
    .catch(err=>{
        console.log(err);
    })
}

export default connect;