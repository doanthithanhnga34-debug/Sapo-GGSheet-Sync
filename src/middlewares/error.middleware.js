
function errorHandler(error,req,res,next){
    console.error(`Error`, error);

    const statusCode = error.statusCode || error.status || 500;

    return res.status(statusCode).json({
        success:false,
        message: error.message || "Internal Server Error, TN"
    })
}

module.exports = errorHandler